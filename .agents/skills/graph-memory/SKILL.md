---
name: graph-memory
description: Real-time shared graph memory for Yulu HSK engineering and pedagogy sessions. Stores durable domain rules, active recall zero-leak invariants, exam standards, skip-level carryover contracts, traffic lights, and lessons learned in WAL-mode SQLite (`_tools/graph-memory/graph_memory.sqlite`) plus an append-only JSONL journal (`_tools/graph-memory/graph_journal.jsonl`), with FTS5/CJK recall, Jaccard duplicate/conflict firewall, reinforcement, quarantine, and zero-poison hygiene audits. Use before modifying recall, midterm/final mock exams, skip-level progression, or the in-app learner graph (`src/lib/learnerGraph.ts`).
---

# Yulu HSK Graph Memory Skill

This skill keeps real-time active learning across agent sessions on `r2-learn-chinese` so hard-won pedagogical invariants (zero-leak Active Recall, shared-character guards, authentic HSK 4 / Jiaocheng exam breakdowns, and Skip-Level zero-fake-mastery carryover) are retained, reinforced, and audited in one shared WAL SQLite graph.

## Storage Files
- CLI tool: `_tools/graph-memory/graph_memory.py`
- WAL SQLite DB: `_tools/graph-memory/graph_memory.sqlite`
- Append-only journal: `_tools/graph-memory/graph_journal.jsonl`
- In-app mirror engine: `src/lib/learnerGraph.ts`

## Core Workflow

1. **Query before editing** (retrieve active rules, standards, and clusters):
   ```bash
   python3 _tools/graph-memory/graph_memory.py init
   python3 _tools/graph-memory/graph_memory.py recall "active recall zero leak"
   python3 _tools/graph-memory/graph_memory.py recall "skip level"
   ```
2. **Record new findings in real time** (Jaccard >= 0.55 conflict firewall prevents duplicate/contradicting rules):
   ```bash
   python3 _tools/graph-memory/graph_memory.py think \
     --agent recall-architect --kind lesson \
     --title "Short rule or finding title" \
     --content "Concrete verified evidence and rule details" \
     --tags "recall exam skip" --confidence 0.9
   ```
   - To update an existing node, pass `--id <node_id>`.
   - To replace an older node cleanly, pass `--supersede <old_id>` or run `upgrade`.
3. **Link & reinforce proven patterns**:
   ```bash
   python3 _tools/graph-memory/graph_memory.py link --src <id1> --rel SUPPORTS --dst <id2> --agent orchestrator --weight 2.0 --strict
   python3 _tools/graph-memory/graph_memory.py reinforce <node_id> --agent orchestrator --note "Verified by unit test suite"
   ```
4. **Quarantine stale or poisoned rules**:
   ```bash
   python3 _tools/graph-memory/graph_memory.py quarantine <node_id> --status quarantined --reason "Why invalid" --by orchestrator
   ```
5. **Coordinate multi-agent handoffs with Traffic Lights**:
   ```bash
   python3 _tools/graph-memory/graph_memory.py signal set --agent exam-builder --light GREEN --task "Building HSK 4 + Jiaocheng mock"
   python3 _tools/graph-memory/graph_memory.py signal pass --from exam-builder --to orchestrator --summary "All 5 question formats verified"
   python3 _tools/graph-memory/graph_memory.py signal status
   ```
6. **Run Zero-Poison Hygiene Audit before sign-off**:
   ```bash
   python3 _tools/graph-memory/graph_memory.py hygiene
   ```
   Zero-poison checks verify:
   - `journal_mode == wal`
   - 0 Jaccard near-duplicate active nodes (`>= 0.55`)
   - 0 dangling edges
   - 0 unresolved active blockers
   - 0 poison patterns (e.g. leaking Hanzi/Pinyin in recall prompts, or marking skipped words comfortable/mastered)
   - 0 contradictory polarity rules
