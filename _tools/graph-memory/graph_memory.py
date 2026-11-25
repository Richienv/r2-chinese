#!/usr/bin/env python3
"""graph_memory.py — Real-Time Active-Learning Graph Memory for Yulu HSK."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sqlite3
from pathlib import Path

GRAPH_DIR = Path(__file__).resolve().parent
REPO_DIR = GRAPH_DIR.parents[1]
DB_PATH = Path(os.environ.get("YULU_GRAPH_DB") or (GRAPH_DIR / "graph_memory.sqlite"))
JOURNAL_PATH = Path(os.environ.get("YULU_GRAPH_JOURNAL") or (GRAPH_DIR / "graph_journal.jsonl"))

NEGATION_RE = re.compile(
    r"\b(never|jangan|not|no|do not|don't|forbid|forbidden|banned|ban|prohibit|avoid|hindari|dilarang|tanpa|must not|cannot)\b",
    re.I,
)

POISON_PATTERNS = (
    ("poison:leak_hanzi_or_pinyin", re.compile(r"\b(show|print|reveal)\s+(target\s+)?(hanzi|pinyin)\s+in\s+(prompt|cue)\b", re.I), "Active recall cue must never leak target Hanzi or Pinyin before answer"),
    ("poison:fake_mastery_on_skip", re.compile(r"\bmark\s+skipped\s+(words|lessons)\s+as\s+(comfortable|mastered)\b", re.I), "Skip-Level must never mark skipped words comfortable or mastered"),
)


def _now() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def _slug(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff_-]+", "_", text.lower()).strip("_")[:48] or "item"


def _norm_tokens(text: str) -> set[str]:
    stop = {"the", "and", "for", "with", "that", "this", "from", "into", "dan", "yang", "untuk", "buat", "dari", "only"}
    ascii_toks = {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) >= 2 and t not in stop}
    han_chars = set(re.findall(r"[\u4e00-\u9fff]", text))
    return ascii_toks | han_chars


def _jaccard_conflicts(title: str, items: list[dict], *, ignore_ids: set[str] | None = None, threshold: float = 0.55) -> list[dict]:
    src = _norm_tokens(title)
    if not src:
        return []
    ignore = ignore_ids or set()
    conflicts = []
    for it in items:
        iid = str(it.get("id", ""))
        if iid in ignore:
            continue
        tgt = _norm_tokens(str(it.get("title") or ""))
        if not tgt:
            continue
        jac = len(src & tgt) / len(src | tgt)
        if jac >= threshold:
            conflicts.append({
                "id": iid,
                "kind": it.get("kind", ""),
                "title": it.get("title", ""),
                "jaccard": round(jac, 3),
            })
    return conflicts


def _fts_query(raw: str) -> str:
    stop = {"the", "a", "an", "and", "or", "for", "of", "in", "on", "to", "di", "dan", "atau", "yang", "untuk", "buat"}
    toks = [t for t in re.findall(r"[a-zA-Z0-9\u4e00-\u9fff]+", raw.lower()) if len(t) >= 2 and t not in stop]
    if not toks:
        return ""
    return " OR ".join(f'"{t}"*' for t in toks[:10])


def _append_journal(event: dict) -> None:
    JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    event.setdefault("ts", _now())
    with JOURNAL_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def _connect_rw() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=15.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 15000;
        PRAGMA synchronous = NORMAL;
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            agent TEXT NOT NULL,
            project TEXT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            confidence REAL DEFAULT 0.85,
            reinforcements INT DEFAULT 1,
            tags TEXT,
            metadata_json TEXT,
            superseded_by TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS edges (
            src TEXT NOT NULL,
            rel TEXT NOT NULL,
            dst TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            agent TEXT,
            note TEXT,
            created_at TEXT,
            PRIMARY KEY (src, rel, dst)
        );
        CREATE TABLE IF NOT EXISTS traffic_lights (
            agent TEXT PRIMARY KEY,
            light TEXT NOT NULL,
            project TEXT,
            task TEXT,
            waiting_on TEXT,
            note TEXT,
            updated_by TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS handoff_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT,
            from_agent TEXT,
            to_agent TEXT,
            turn_num INT,
            summary TEXT,
            artifact TEXT,
            created_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_gm_nodes ON nodes(kind, status, agent, project);
        CREATE INDEX IF NOT EXISTS idx_gm_edges_src ON edges(src, rel);
        CREATE INDEX IF NOT EXISTS idx_gm_edges_dst ON edges(dst, rel);
        CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
            id, kind, agent, project, title, content, tags
        );
        """
    )
    return conn


def _connect_ro() -> sqlite3.Connection | None:
    if not DB_PATH.exists():
        return None
    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def _upsert_node(
    conn: sqlite3.Connection,
    *,
    nid: str,
    kind: str,
    agent: str,
    project: str,
    title: str,
    content: str,
    status: str = "active",
    confidence: float = 0.85,
    tags: str = "",
    metadata: dict | None = None,
    superseded_by: str | None = None,
) -> dict:
    now = _now()
    conn.execute("BEGIN IMMEDIATE")
    try:
        prev = conn.execute("SELECT created_at, reinforcements FROM nodes WHERE id = ?", (nid,)).fetchone()
        created = prev["created_at"] if prev else now
        reinf = (prev["reinforcements"] + 1) if prev else 1
        meta_str = json.dumps(metadata or {}, ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO nodes(id, kind, agent, project, title, content, status, confidence, reinforcements, tags, metadata_json, superseded_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                kind=excluded.kind,
                agent=excluded.agent,
                project=excluded.project,
                title=excluded.title,
                content=excluded.content,
                status=excluded.status,
                confidence=excluded.confidence,
                reinforcements=excluded.reinforcements,
                tags=excluded.tags,
                metadata_json=excluded.metadata_json,
                superseded_by=COALESCE(excluded.superseded_by, nodes.superseded_by),
                updated_at=excluded.updated_at
            """,
            (nid, kind, agent, project, title, content, status, confidence, reinf, tags, meta_str, superseded_by, created, now),
        )
        conn.execute("DELETE FROM nodes_fts WHERE id = ?", (nid,))
        conn.execute(
            "INSERT INTO nodes_fts(id, kind, agent, project, title, content, tags) VALUES (?,?,?,?,?,?,?)",
            (nid, kind, agent, project, title, content, tags),
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise

    _append_journal({
        "op": "upsert_node",
        "id": nid,
        "kind": kind,
        "agent": agent,
        "project": project,
        "title": title,
        "status": status,
        "confidence": confidence,
    })
    return {"id": nid, "kind": kind, "agent": agent, "project": project, "title": title, "status": status, "reinforcements": reinf}


def _upsert_edge(
    conn: sqlite3.Connection,
    *,
    src: str,
    rel: str,
    dst: str,
    agent: str,
    note: str = "",
    weight: float = 1.0,
) -> None:
    now = _now()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            """
            INSERT INTO edges(src, rel, dst, weight, agent, note, created_at)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(src, rel, dst) DO UPDATE SET
                weight=excluded.weight,
                agent=excluded.agent,
                note=CASE WHEN length(excluded.note) >= length(edges.note) THEN excluded.note ELSE edges.note END
            """,
            (src, rel, dst, weight, agent, note, now),
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    _append_journal({"op": "upsert_edge", "src": src, "rel": rel, "dst": dst, "agent": agent, "weight": weight, "note": note})


def seed_initial(conn: sqlite3.Connection) -> None:
    agents = [
        ("agent:orchestrator", "orchestrator", "Yulu HSK Orchestrator", "Coordinates Yulu HSK sprints, verifies i18n/typecheck/tests/build, and guards zero-leak & real-recall invariants."),
        ("agent:recall-architect", "recall-architect", "Active Recall & Context Architect", "Owns src/lib/recallContext.ts, src/lib/synonymClusters.ts, WordRecall, Review, and zero-leak redaction."),
        ("agent:exam-builder", "exam-builder", "Midterm & Final Simulator Builder", "Owns Jiaocheng (L1-25) + HSK 4 + Mixed Final mock exams, sentence ordering, error correction, and grammar breakdowns."),
        ("agent:graph-memory", "graph-memory", "Real-Time Learner & Agent Graph Owner", "Owns _tools/graph-memory/graph_memory.py and src/lib/learnerGraph.ts real-time confusion/skip/weak-grammar priority loop."),
    ]
    for nid, ag, title, cont in agents:
        _upsert_node(conn, nid=nid, kind="agent_registry", agent=ag, project="yulu-hsk", title=title, content=cont, confidence=1.0, tags="agent registry yulu")

    domain_nodes = [
        (
            "rule:active_recall_zero_leak",
            "hard_rule",
            "recall-architect",
            "Active Recall Zero-Leak Rule (No Target Hanzi or Pinyin Before Answer)",
            "Never expose target Hanzi or target Pinyin in coreMeaning, otherMeanings, blanked sentence, translation, whenCue, disambiguation, or near-synonym feedback before the learner submits or reveals.",
            1.0,
            "active_recall zero_leak redaction pos_pill",
        ),
        (
            "rule:near_synonym_shared_char_guard",
            "hard_rule",
            "recall-architect",
            "Near-Synonym Shared-Character Guard (e.g. 刚才 vs 刚)",
            "When a learner types a close near-synonym sharing a Hanzi character with the target (such as 刚才 when prompted for 刚, or 还是 for 或者), omit the typed Hanzi from the feedback message so the shared character never leaks the answer.",
            1.0,
            "synonym shared_char 刚 刚才 还是 或者",
        ),
        (
            "rule:pos_and_slot_cues",
            "standard",
            "recall-architect",
            "POS Label + Character-Slot Cues in Learner Language (EN/ID)",
            "Always display localized part-of-speech pills (e.g. Classifier -> Kata bantu bilangan) and exact character-count slot previews (＿) so classifiers and homographs like 对 vs 双/副 are unambiguous without leaking.",
            0.95,
            "posLabel classifier 对 双 副 i18n id en",
        ),
        (
            "rule:context_window_translation_alignment",
            "standard",
            "recall-architect",
            "Context Window Must Preserve Aligned Translation on Long Sentences",
            "When trimming multi-sentence or long textbook contexts around the blank (<=30 Hanzi), select the sentence/clauses holding the blank and preserve proportional or clause-aligned EN/ID translation rather than dropping it.",
            0.95,
            "contextWindow translation alignment blank",
        ),
        (
            "std:midterm_final_multicourse",
            "standard",
            "exam-builder",
            "Midterm & Final Exam Simulator Covers Jiaocheng L1-25, HSK 4, and Mixed Mode",
            "Expose entry points from both Jiaocheng and HSK 4 / Home / Learn. Support Full Mock (timed & untimed) and Focused Grammar Drill across Jiaocheng Part 2-1 & 2-2 (L1-25), HSK 4 (L1-10), and Mixed Final.",
            0.98,
            "midterm final jiaocheng hsk4 mock timed grammar",
        ),
        (
            "std:hsk4_exam_formats",
            "standard",
            "exam-builder",
            "Five Authentic Exam Formats: Blanks, Choice, Sentence Order, Error Fix, Reading",
            "Every mock covers 选词填空 (word bank blanks), particle/complement/conjunction choice, 语序排列 (interactive chunk reordering), 病句修改 (spot & fix grammar errors), and 阅读理解 (reading inference).",
            0.98,
            "exam formats blanks choice order error reading 语序排列 病句修改",
        ),
        (
            "std:midterm_final_grammar_breakdown",
            "hard_rule",
            "exam-builder",
            "Every Exam Question Renders Structured EN/ID Grammar Breakdown + Updates Graph",
            "Every exam item provides Pattern/Formula, Why the right answer fits, and Why each distractor fails in active language (ID/EN), and writes outcome into src/lib/learnerGraph.ts on check.",
            1.0,
            "grammar breakdown distractor learnerGraph i18n",
        ),
        (
            "rule:skip_level_no_fake_mastery",
            "hard_rule",
            "orchestrator",
            "Skip-Level Mandatory Active Recall Carryover (Zero Fake Mastery)",
            "Jumping directly to Lesson 13 in Jiaocheng (or any lesson/chapter in HSK 4 / Kerja) unlocks the target lesson immediately, MUST NOT mark skipped words as isComfortable or mastered, enqueues skipped vocab/skills as skipped-needs-recall in SRS + learnerGraph (SKIPPED_NEEDS_RECALL), and prioritizes them in Active Recall / Review / Mixed Practice.",
            1.0,
            "skip_level lesson_13 active_recall carryover no_fake_mastery",
        ),
        (
            "rule:skip_level_unskip_revisit",
            "standard",
            "orchestrator",
            "Skipped Lessons Remain Revisitable and Un-skippable Anytime",
            "Path UI clearly distinguishes Completed (done), Skipped -> Active Recall (skipped), and Current (current). Learners can revisit any skipped beat or un-skip an earlier lesson anytime.",
            0.95,
            "skip_level path skipped done current unskip revisit",
        ),
        (
            "rule:learner_graph_realtime_priority",
            "standard",
            "graph-memory",
            "Real-Time Learner Graph Feeds Priority Weights Back Into Recall Queues",
            "src/lib/learnerGraph.ts tracks word, grammar_point, lesson, skipped_skill, and confusion_pair nodes with STRUGGLED_WITH, CONFUSED_WITH, SKIPPED_NEEDS_RECALL, RECALLED_CLEANLY, and GRAMMAR_ERROR_ON edges, persisting via localStorage + export + cloud merge.",
            0.98,
            "learnerGraph priority weights active_recall sync backup",
        ),
        (
            "cluster:core_confusions",
            "domain_cluster",
            "graph-memory",
            "Core Mandarin Confusion Pairs: 对↔双↔副, 再↔又, 就↔才, 不↔没有, 了↔着↔过",
            "High-frequency learner confusions tracked in both synonymClusters.ts and learnerGraph.ts: 对/双/副, 再/又, 就/才, 不/没有, 了/着/过, 刚/刚才, 还是/或者, 把/被, 只要…就/只有…才.",
            0.95,
            "confusion pair 对 双 再 又 就 才 不 没有 了 过",
        ),
    ]
    for nid, kind, ag, title, cont, conf, tags in domain_nodes:
        _upsert_node(conn, nid=nid, kind=kind, agent=ag, project="yulu-hsk", title=title, content=cont, confidence=conf, tags=tags)

    edges = [
        ("rule:active_recall_zero_leak", "GOVERNS", "agent:recall-architect", "Zero leak invariant"),
        ("rule:near_synonym_shared_char_guard", "SUPPORTS", "rule:active_recall_zero_leak", "Prevents shared-character hints from leaking"),
        ("rule:pos_and_slot_cues", "SUPPORTS", "rule:active_recall_zero_leak", "Disambiguates without leaking"),
        ("std:hsk4_exam_formats", "PART_OF", "std:midterm_final_multicourse", "Exam structure"),
        ("std:midterm_final_grammar_breakdown", "FEEDS", "rule:learner_graph_realtime_priority", "Exam errors reinforce weak grammar nodes"),
        ("rule:skip_level_no_fake_mastery", "FEEDS", "rule:learner_graph_realtime_priority", "Skipped skills enter SKIPPED_NEEDS_RECALL"),
        ("rule:skip_level_unskip_revisit", "SUPPORTS", "rule:skip_level_no_fake_mastery", "Transparent UI state"),
        ("cluster:core_confusions", "REINFORCES", "rule:learner_graph_realtime_priority", "Seed confusion pairs"),
    ]
    for src, rel, dst, note in edges:
        _upsert_edge(conn, src=src, rel=rel, dst=dst, agent="orchestrator", note=note, weight=2.0)


def cmd_init(_args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        seed_initial(conn)
        cnt_n = conn.execute("SELECT count(*) FROM nodes").fetchone()[0]
        cnt_e = conn.execute("SELECT count(*) FROM edges").fetchone()[0]
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        print(f"Initialized Yulu Graph Memory -> {DB_PATH} (mode={mode}, {cnt_n} nodes, {cnt_e} edges)")
        return 0
    finally:
        conn.close()


def cmd_think(args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        nid = args.id or f"{args.kind}:{args.agent}:{_slug(args.title)}"
        active_nodes = [
            dict(r)
            for r in conn.execute(
                "SELECT id, kind, title, content FROM nodes WHERE status='active' AND kind NOT IN ('agent_registry')"
            ).fetchall()
        ]
        ignore = {nid}
        if args.supersede:
            ignore.add(args.supersede)
        conflicts = _jaccard_conflicts(args.title, active_nodes, ignore_ids=ignore)
        if conflicts and not args.force:
            print(f"[Conflict BLOCKED] Similar active node(s) detected (Jaccard >= 0.55): {json.dumps(conflicts, ensure_ascii=False)}")
            print("  Pass --id <existing_id> to update, --supersede <old_id> to upgrade, or --force to store anyway.")
            return 2

        if args.supersede:
            old = conn.execute("SELECT id FROM nodes WHERE id = ?", (args.supersede,)).fetchone()
            if not old:
                print(f"[Think] Cannot supersede missing node: {args.supersede}")
                return 2
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("UPDATE nodes SET status='superseded', superseded_by=?, updated_at=? WHERE id=?", (nid, _now(), args.supersede))
            conn.execute("COMMIT")
            _upsert_edge(conn, src=nid, rel="SUPERSEDES", dst=args.supersede, agent=args.agent, note=f"Superseded via think: {args.title}", weight=3.0)

        res = _upsert_node(
            conn,
            nid=nid,
            kind=args.kind,
            agent=args.agent,
            project=args.project,
            title=args.title,
            content=args.content,
            status=args.status,
            confidence=args.confidence,
            tags=args.tags,
            metadata={"conflicts_overridden": conflicts} if conflicts else None,
        )
        if args.link_rel and args.link_to:
            _upsert_edge(conn, src=nid, rel=args.link_rel, dst=args.link_to, agent=args.agent, note=args.title)
        print(f"[Graph] Stored {res['id']} ({res['kind']}, agent={res['agent']}, conf={args.confidence}, x{res['reinforcements']})")
        return 0
    finally:
        conn.close()


def cmd_link(args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        if args.strict:
            missing = [x for x in (args.src, args.dst) if not conn.execute("SELECT 1 FROM nodes WHERE id = ?", (x,)).fetchone()]
            if missing:
                print(f"[Link BLOCKED] Strict mode forbids dangling endpoints: {missing}")
                return 2
        _upsert_edge(conn, src=args.src, rel=args.rel, dst=args.dst, agent=args.agent, note=args.note, weight=args.weight)
        print(f"[Graph] Linked {args.src} --{args.rel}--> {args.dst} (weight={args.weight})")
        return 0
    finally:
        conn.close()


def cmd_reinforce(args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        row = conn.execute("SELECT * FROM nodes WHERE id = ?", (args.node_id,)).fetchone()
        if not row:
            print(f"[Graph] Node not found: {args.node_id}")
            return 2
        new_conf = min(1.0, round(float(row["confidence"]) + args.delta, 3))
        new_reinf = int(row["reinforcements"]) + 1
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE nodes SET confidence=?, reinforcements=?, updated_at=? WHERE id=?",
            (new_conf, new_reinf, _now(), args.node_id),
        )
        conn.execute("COMMIT")
        if args.note:
            _upsert_edge(conn, src=f"agent:{args.agent}", rel="SUPPORTS", dst=args.node_id, agent=args.agent, note=args.note)
        _append_journal({"op": "reinforce", "id": args.node_id, "agent": args.agent, "confidence": new_conf, "reinforcements": new_reinf})
        print(f"[Graph] Reinforced {args.node_id}: confidence={new_conf}, reinforcements={new_reinf}")
        return 0
    finally:
        conn.close()


def cmd_upgrade(args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        old = conn.execute("SELECT * FROM nodes WHERE id = ?", (args.old,)).fetchone()
        if not old:
            print(f"[Graph] Old node not found: {args.old}")
            return 2
        new_id = args.new_id or f"upgraded:{_slug(args.title)}"
        _upsert_node(
            conn,
            nid=new_id,
            kind=old["kind"],
            agent=args.agent,
            project=old["project"] or "yulu-hsk",
            title=args.title,
            content=f"{args.content} | Upgrade reason: {args.reason}",
            status="active",
            confidence=max(float(old["confidence"]), 0.9),
            tags=f"{old['tags'] or ''} upgraded".strip(),
        )
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("UPDATE nodes SET status='superseded', superseded_by=?, updated_at=? WHERE id=?", (new_id, _now(), args.old))
        conn.execute("COMMIT")
        _upsert_edge(conn, src=new_id, rel="SUPERSEDES", dst=args.old, agent=args.agent, note=args.reason, weight=3.0)
        _append_journal({"op": "upgrade", "old": args.old, "new": new_id, "agent": args.agent, "reason": args.reason})
        print(f"[Graph] Upgraded {args.old} -> {new_id}")
        return 0
    finally:
        conn.close()


def cmd_quarantine(args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        row = conn.execute("SELECT * FROM nodes WHERE id = ?", (args.node_id,)).fetchone()
        if not row:
            print(f"[Graph] Node not found: {args.node_id}")
            return 2
        try:
            meta = json.loads(row["metadata_json"] or "{}")
        except Exception:
            meta = {}
        meta.update({"quarantine_reason": args.reason, "quarantined_by": args.by, "quarantined_at": _now()})
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE nodes SET status=?, metadata_json=?, updated_at=? WHERE id=?",
            (args.status, json.dumps(meta, ensure_ascii=False), _now(), args.node_id),
        )
        conn.execute("COMMIT")
        _append_journal({"op": "quarantine", "id": args.node_id, "status": args.status, "by": args.by, "reason": args.reason})
        print(f"[Graph] Quarantined {args.node_id} -> status={args.status} ({args.reason})")
        return 0
    finally:
        conn.close()


def cmd_recall(args: argparse.Namespace) -> int:
    conn = _connect_ro()
    if not conn:
        print("Graph DB not initialized. Run `graph_memory.py init` first.")
        return 2
    try:
        fts = _fts_query(args.query)
        where = [] if args.include_superseded else ["n.status NOT IN ('superseded', 'quarantined', 'resolved', 'rejected')"]
        params: list = []
        if args.agent:
            where.append("n.agent = ?")
            params.append(args.agent)
        if args.project:
            where.append("n.project = ?")
            params.append(args.project)
        if args.kind:
            where.append("n.kind = ?")
            params.append(args.kind)

        rows: list[dict] = []
        if fts:
            wsql = (" AND " + " AND ".join(where)) if where else ""
            sql = f"""
                SELECT n.*, (n.confidence * (1.0 + 0.15 * n.reinforcements)) AS rank_boost
                FROM nodes_fts f
                JOIN nodes n ON n.id = f.id
                WHERE nodes_fts MATCH ? {wsql}
                ORDER BY rank_boost DESC, bm25(nodes_fts)
                LIMIT ?
            """
            rows = [dict(r) for r in conn.execute(sql, [fts, *params, args.limit]).fetchall()]

        # Fallback keyword/CJK search when FTS yields empty or query has single Hanzi chars
        if not rows:
            terms = [t for t in re.findall(r"[\u4e00-\u9fff]|[a-zA-Z0-9_-]{2,}", args.query.lower())] or [args.query.lower()]
            like_clauses = ["(lower(n.title || ' ' || n.content || ' ' || coalesce(n.tags,'')) LIKE ?)" for _ in terms[:6]]
            like_params = [f"%{term}%" for term in terms[:6]]
            all_where = [*where, "(" + " OR ".join(like_clauses) + ")"]
            sql = f"""
                SELECT n.*, (n.confidence * (1.0 + 0.15 * n.reinforcements)) AS rank_boost
                FROM nodes n
                WHERE {' AND '.join(all_where)}
                ORDER BY rank_boost DESC, n.updated_at DESC
                LIMIT ?
            """
            rows = [dict(r) for r in conn.execute(sql, [*params, *like_params, args.limit]).fetchall()]

        for r in rows:
            eds = conn.execute("SELECT src, rel, dst, weight, note FROM edges WHERE src = ? OR dst = ? LIMIT 8", (r["id"], r["id"])).fetchall()
            r["edges"] = [dict(e) for e in eds]

        if args.json:
            print(json.dumps({"query": args.query, "hits": rows}, indent=2, ensure_ascii=False))
        else:
            print(f"=== GRAPH RECALL: {args.query!r} ({len(rows)} hits) ===")
            for r in rows:
                print(f"- {r['id']} ({r['kind']}, agent={r['agent']}, status={r['status']}, conf={r['confidence']}, x{r['reinforcements']}): {r['title']}")
                print(f"    {r['content'][:220]}")
                for e in r["edges"][:3]:
                    print(f"    edge: {e['src']} --{e['rel']}({e['weight']})--> {e['dst']} ({e['note']})")
        return 0
    finally:
        conn.close()


def _light_icon(light: str) -> str:
    return {"GREEN": "🟩 GREEN", "YELLOW": "🟨 YELLOW", "RED": "🟥 RED"}.get(light.upper(), light)


def cmd_signal(args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        now = _now()
        if args.sig_cmd == "set":
            light = args.light.upper()
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(
                """
                INSERT INTO traffic_lights(agent, light, project, task, waiting_on, note, updated_by, updated_at)
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(agent) DO UPDATE SET
                    light=excluded.light, project=excluded.project, task=excluded.task,
                    waiting_on=excluded.waiting_on, note=excluded.note,
                    updated_by=excluded.updated_by, updated_at=excluded.updated_at
                """,
                (args.agent, light, args.project, args.task, args.waiting_on or "", args.note or "", args.by, now),
            )
            conn.execute("COMMIT")
            _append_journal({"op": "signal_set", "agent": args.agent, "light": light, "project": args.project, "task": args.task})
            print(f"[Signal] {args.agent} -> {_light_icon(light)} ({args.task})")
            return 0

        if args.sig_cmd == "pass":
            pair_cnt = conn.execute(
                "SELECT COUNT(*) FROM handoff_log WHERE project=? AND ((from_agent=? AND to_agent=?) OR (from_agent=? AND to_agent=?))",
                (args.project, args.from_agent, args.to_agent, args.to_agent, args.from_agent),
            ).fetchone()[0]
            turn_num = int(pair_cnt) + 1
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(
                "INSERT INTO handoff_log(project, from_agent, to_agent, turn_num, summary, artifact, created_at) VALUES (?,?,?,?,?,?,?)",
                (args.project, args.from_agent, args.to_agent, turn_num, args.summary, args.artifact or "", now),
            )
            conn.execute(
                """
                INSERT INTO traffic_lights(agent, light, project, task, waiting_on, note, updated_by, updated_at)
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(agent) DO UPDATE SET
                    light='RED', project=excluded.project, task=excluded.task, waiting_on=excluded.waiting_on,
                    note=excluded.note, updated_by=excluded.updated_by, updated_at=excluded.updated_at
                """,
                (args.from_agent, "RED", args.project, f"Baton passed -> {args.to_agent}", args.to_agent, args.summary, args.from_agent, now),
            )
            conn.execute(
                """
                INSERT INTO traffic_lights(agent, light, project, task, waiting_on, note, updated_by, updated_at)
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(agent) DO UPDATE SET
                    light='GREEN', project=excluded.project, task=excluded.task, waiting_on='',
                    note=excluded.note, updated_by=excluded.updated_by, updated_at=excluded.updated_at
                """,
                (args.to_agent, "GREEN", args.project, f"Active baton from {args.from_agent} (turn {turn_num})", "", args.summary, args.from_agent, now),
            )
            conn.execute("COMMIT")
            _append_journal({"op": "signal_pass", "project": args.project, "from": args.from_agent, "to": args.to_agent, "turn": turn_num})
            print(f"[Baton Pass #{turn_num}] {args.from_agent} -> {args.to_agent} | {args.summary}")
            return 0

        if args.sig_cmd == "status":
            wq = "WHERE project=?" if args.project else ""
            wp = [args.project] if args.project else []
            rows = [dict(r) for r in conn.execute(f"SELECT * FROM traffic_lights {wq} ORDER BY CASE light WHEN 'GREEN' THEN 0 WHEN 'YELLOW' THEN 1 ELSE 2 END, agent", wp).fetchall()]
            if args.json:
                print(json.dumps(rows, indent=2, ensure_ascii=False))
            else:
                print("=== TRAFFIC LIGHTS ===")
                for r in rows:
                    print(f"  {_light_icon(r['light']):12s} {r['agent']:18s} | {r['task']}")
                if not rows:
                    print("  (none set)")
            return 0
        return 1
    finally:
        conn.close()


def cmd_hygiene(args: argparse.Namespace) -> int:
    conn = _connect_rw()
    try:
        active_nodes = [
            dict(r)
            for r in conn.execute(
                "SELECT id, kind, title, content, status FROM nodes WHERE status='active' AND kind NOT IN ('agent_registry')"
            ).fetchall()
        ]
        duplicates = []
        for i, a in enumerate(active_nodes):
            ta = _norm_tokens(a["title"])
            if not ta:
                continue
            for b in active_nodes[i + 1 :]:
                tb = _norm_tokens(b["title"])
                if not tb:
                    continue
                jac = len(ta & tb) / len(ta | tb)
                if jac >= 0.55:
                    duplicates.append({"a": a["id"], "b": b["id"], "jaccard": round(jac, 3)})

        dangling_edges = [
            dict(r)
            for r in conn.execute(
                "SELECT e.src, e.rel, e.dst FROM edges e LEFT JOIN nodes n1 ON e.src=n1.id LEFT JOIN nodes n2 ON e.dst=n2.id WHERE n1.id IS NULL OR n2.id IS NULL"
            ).fetchall()
        ]
        active_blockers = [
            dict(r)
            for r in conn.execute("SELECT id, agent, title FROM nodes WHERE kind='blocker' AND status='active'").fetchall()
        ]
        poison_hits = []
        for n in active_nodes:
            blob = f"{n['title']} {n['content']}"
            for pid, pat, reason in POISON_PATTERNS:
                if pat.search(blob) and not NEGATION_RE.search(blob):
                    poison_hits.append({"id": n["id"], "rule": pid, "reason": reason})

        # Check polarity contradiction between active rules sharing >= 0.40 tokens
        polarity_conflicts = []
        rules = [n for n in active_nodes if n["kind"] in ("hard_rule", "standard")]
        for i, a in enumerate(rules):
            ta = _norm_tokens(a["title"] + " " + a["content"])
            neg_a = bool(NEGATION_RE.search(a["title"] + " " + a["content"]))
            for b in rules[i + 1 :]:
                tb = _norm_tokens(b["title"] + " " + b["content"])
                neg_b = bool(NEGATION_RE.search(b["title"] + " " + b["content"]))
                if ta and tb and neg_a != neg_b:
                    jac = len(ta & tb) / len(ta | tb)
                    if jac >= 0.45:
                        polarity_conflicts.append({"a": a["id"], "b": b["id"], "jaccard": round(jac, 3)})

        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        alerts = len(duplicates) + len(dangling_edges) + len(active_blockers) + len(poison_hits) + len(polarity_conflicts)
        payload = {
            "verdict": "CLEAN" if alerts == 0 else "ALERTS",
            "alerts": alerts,
            "journal_mode": journal_mode,
            "duplicates": duplicates,
            "dangling_edges": dangling_edges,
            "active_blockers": active_blockers,
            "poison_hits": poison_hits,
            "polarity_conflicts": polarity_conflicts,
        }
        if args.json:
            print(json.dumps(payload, indent=2, ensure_ascii=False))
        else:
            print(f"=== GRAPH MEMORY HYGIENE: {payload['verdict']} (alerts={alerts}, journal_mode={journal_mode}) ===")
            if alerts == 0:
                print("  [OK] Zero duplicates, zero dangling edges, zero blockers, zero poison or polarity conflicts.")
            else:
                for k in ("duplicates", "dangling_edges", "active_blockers", "poison_hits", "polarity_conflicts"):
                    if payload[k]:
                        print(f"  [{k.upper()}]: {payload[k]}")
        return 0 if alerts == 0 else 2
    finally:
        conn.close()


def cmd_board(args: argparse.Namespace) -> int:
    conn = _connect_ro()
    if not conn:
        print("Graph DB not initialized. Run `graph_memory.py init` first.")
        return 2
    try:
        lights = [dict(r) for r in conn.execute("SELECT * FROM traffic_lights ORDER BY agent").fetchall()]
        nodes = [dict(r) for r in conn.execute("SELECT id, kind, agent, title, confidence, reinforcements, status FROM nodes WHERE status='active' ORDER BY (confidence*(1+0.15*reinforcements)) DESC LIMIT 20").fetchall()]
        edges = [dict(r) for r in conn.execute("SELECT src, rel, dst, weight FROM edges ORDER BY weight DESC LIMIT 20").fetchall()]
        if args.json:
            print(json.dumps({"traffic_lights": lights, "top_nodes": nodes, "edges": edges}, indent=2, ensure_ascii=False))
        else:
            print("=== YULU GRAPH MEMORY BOARD ===")
            print(f"Traffic lights: {len(lights)} | Active top nodes: {len(nodes)} | Edges shown: {len(edges)}")
            for n in nodes:
                print(f"  - {n['id']} ({n['kind']}, conf={n['confidence']}, x{n['reinforcements']}): {n['title']}")
        return 0
    finally:
        conn.close()


def cmd_stats(args: argparse.Namespace) -> int:
    conn = _connect_ro()
    if not conn:
        print("Graph DB not initialized. Run `graph_memory.py init` first.")
        return 2
    try:
        by_kind = {r["kind"]: r["c"] for r in conn.execute("SELECT kind, count(*) c FROM nodes GROUP BY kind ORDER BY kind")}
        by_status = {r["status"]: r["c"] for r in conn.execute("SELECT status, count(*) c FROM nodes GROUP BY status ORDER BY status")}
        edge_cnt = conn.execute("SELECT count(*) FROM edges").fetchone()[0]
        payload = {"db_path": str(DB_PATH), "nodes_total": sum(by_kind.values()), "edges_total": edge_cnt, "by_kind": by_kind, "by_status": by_status}
        if args.json:
            print(json.dumps(payload, indent=2, ensure_ascii=False))
        else:
            print(f"DB: {DB_PATH} | Nodes: {payload['nodes_total']} | Edges: {edge_cnt}")
            print("By kind:", by_kind)
            print("By status:", by_status)
        return 0
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(prog="graph_memory", description="Yulu HSK Real-Time Graph Memory CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="Initialize WAL SQLite + FTS5 + seed Yulu HSK domain rules")

    p_th = sub.add_parser("think", help="Store or update a node with Jaccard conflict detection")
    p_th.add_argument("--agent", required=True)
    p_th.add_argument("--kind", required=True)
    p_th.add_argument("--title", required=True)
    p_th.add_argument("--content", required=True)
    p_th.add_argument("--project", default="yulu-hsk")
    p_th.add_argument("--tags", default="")
    p_th.add_argument("--confidence", type=float, default=0.85)
    p_th.add_argument("--status", default="active")
    p_th.add_argument("--id", default=None)
    p_th.add_argument("--link-rel", default=None)
    p_th.add_argument("--link-to", default=None)
    p_th.add_argument("--supersede", default=None)
    p_th.add_argument("--force", action="store_true")

    p_lk = sub.add_parser("link", help="Connect two graph nodes with weighted edge")
    p_lk.add_argument("--src", required=True)
    p_lk.add_argument("--rel", required=True)
    p_lk.add_argument("--dst", required=True)
    p_lk.add_argument("--agent", required=True)
    p_lk.add_argument("--note", default="")
    p_lk.add_argument("--weight", type=float, default=1.0)
    p_lk.add_argument("--strict", action="store_true")

    p_rf = sub.add_parser("reinforce", help="Reinforce confidence and reinforcement count of a node")
    p_rf.add_argument("node_id")
    p_rf.add_argument("--agent", required=True)
    p_rf.add_argument("--delta", type=float, default=0.05)
    p_rf.add_argument("--note", default="")

    p_up = sub.add_parser("upgrade", help="Supersede an older node with an upgraded version")
    p_up.add_argument("--old", required=True)
    p_up.add_argument("--agent", required=True)
    p_up.add_argument("--title", required=True)
    p_up.add_argument("--content", required=True)
    p_up.add_argument("--reason", required=True)
    p_up.add_argument("--new-id", default=None)

    p_qr = sub.add_parser("quarantine", help="Quarantine, resolve, or supersede a node")
    p_qr.add_argument("node_id")
    p_qr.add_argument("--status", required=True, choices=["quarantined", "resolved", "superseded"])
    p_qr.add_argument("--reason", required=True)
    p_qr.add_argument("--by", default="orchestrator")

    p_rc = sub.add_parser("recall", help="Search live graph memory via FTS5 + keyword fallback")
    p_rc.add_argument("query")
    p_rc.add_argument("--agent", default=None)
    p_rc.add_argument("--project", default=None)
    p_rc.add_argument("--kind", default=None)
    p_rc.add_argument("--include-superseded", action="store_true")
    p_rc.add_argument("--limit", type=int, default=10)
    p_rc.add_argument("--json", action="store_true")

    p_sig = sub.add_parser("signal", help="Manage traffic lights and agent handoffs")
    sig_sub = p_sig.add_subparsers(dest="sig_cmd", required=True)
    p_ss = sig_sub.add_parser("set")
    p_ss.add_argument("--agent", required=True)
    p_ss.add_argument("--light", required=True, choices=["GREEN", "YELLOW", "RED", "green", "yellow", "red"])
    p_ss.add_argument("--project", default="yulu-hsk")
    p_ss.add_argument("--task", required=True)
    p_ss.add_argument("--waiting-on", default="")
    p_ss.add_argument("--note", default="")
    p_ss.add_argument("--by", default="orchestrator")

    p_sp = sig_sub.add_parser("pass")
    p_sp.add_argument("--from", dest="from_agent", required=True)
    p_sp.add_argument("--to", dest="to_agent", required=True)
    p_sp.add_argument("--project", default="yulu-hsk")
    p_sp.add_argument("--summary", required=True)
    p_sp.add_argument("--artifact", default="")

    p_sst = sig_sub.add_parser("status")
    p_sst.add_argument("--project", default=None)
    p_sst.add_argument("--json", action="store_true")

    p_hy = sub.add_parser("hygiene", help="Zero-poison audit: duplicates, dangling edges, blockers, contradictions")
    p_hy.add_argument("--json", action="store_true")

    p_bd = sub.add_parser("board", help="Print active dashboard")
    p_bd.add_argument("--json", action="store_true")

    p_st = sub.add_parser("stats", help="Print graph node and edge counts")
    p_st.add_argument("--json", action="store_true")

    args = parser.parse_args()
    dispatch = {
        "init": cmd_init,
        "think": cmd_think,
        "link": cmd_link,
        "reinforce": cmd_reinforce,
        "upgrade": cmd_upgrade,
        "quarantine": cmd_quarantine,
        "recall": cmd_recall,
        "signal": cmd_signal,
        "hygiene": cmd_hygiene,
        "board": cmd_board,
        "stats": cmd_stats,
    }
    return dispatch[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
