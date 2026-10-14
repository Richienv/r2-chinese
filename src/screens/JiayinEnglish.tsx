import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from '../components/Icons'
import { HearButton } from '../components/Hear'
import { englishPrepQuestions, jiayinEnglishData as data, useJiayinEnglishProgress } from '../lib/jiayinEnglish'
import { englishEvidence, englishEvidenceKey, englishPrepQueue, isEnglishPrepReady, latestEnglishAttempt, nextEnglishQuestion, type EnglishPrepQuestion } from '../lib/jiayinEnglishPractice'
import { jiayinData, jiayinItems, useJiayinProgress } from '../lib/jiayin'
import { jiayinEvidenceNotes } from '../lib/jiayinPractice'
import { recordHistory } from '../lib/history'
import { clearStep, readStep, writeStep } from '../lib/resume'
import type { JiayinOpen } from './Jiayin'
import '../styles/jiayin-english.css'

const PDF_URL = '/preparation/Jiayin_MT_English_First_Prep_EN_ID.pdf'

export function JiayinEnglishPath({ onPlay, onMandarin }: { onPlay: JiayinOpen; onMandarin: () => void }) {
  const { progress } = useJiayinEnglishProgress()
  const core = englishPrepQuestions.filter(q => q.priority)
  const ready = core.filter(q => isEnglishPrepReady(q, latestEnglishAttempt(progress, q.id)))
  const next = core.find(q => !isEnglishPrepReady(q, latestEnglishAttempt(progress, q.id))) ?? core[0]
  const review = englishPrepQueue(englishPrepQuestions, progress, 'review')
  const open = (id: string) => onPlay(0, `english:${id}`)
  return <div className="jiayin-path jiayin-english-path">
    <section className="jiayin-hero jiayin-english-hero">
      <span className="kicker-ink">GLOBAL MANAGEMENT TRAINEE · 15 OKTOBER 2026</span>
      <h2>Jelaskan pengalamanmu. Tunjukkan nilai bisnismu.</h2>
      <p>Latihan jawaban dalam English, penjelasan Indonesia. Fokus pada CV, stakeholder, koordinasi proyek, data, dan kontribusi untuk pasar Indonesia. Mandarin bisa dipelajari saat kamu membutuhkannya.</p>
      <div className="jiayin-english-tags"><span>English untuk menjawab</span><span>Indonesia untuk memahami</span><span>Mandarin opsional</span></div>
      <button className="btn" onClick={() => open(next.id)}>{ready.length ? 'Lanjut persiapan English' : 'Mulai dari perkenalan'}<small>{next.questionEn}</small></button>
      <div className="jiayin-summary"><span>{ready.length}/{core.length} jawaban utama siap menurut penilaianmu</span><span>{review.length} perlu dilatih ulang</span></div>
      <small>Siap berarti kamu menjawab tanpa contoh, memeriksa kriteria isi, dan melengkapi cerita asli jika diperlukan. Ini penilaian diri, bukan pemeriksaan otomatis.</small>
    </section>
    <div className="jiayin-actions"><button className="jiayin-secondary" onClick={() => onPlay(0, 'english-mock')}>Simulasi English<small>{core.length} pertanyaan utama + 3 kasus · satu per satu</small></button><button className="jiayin-secondary" disabled={!review.length} onClick={() => onPlay(0, 'english-review')}>Ulangi jawaban lemah<small>Jawaban dibantu, belum lengkap, atau masih berupa draf</small></button></div>
    <section className="jiayin-panel jiayin-english-positioning"><span className="kicker-ink">Pesan utama yang harus diingat interviewer</span><h3 lang="en">{data.positioning}</h3><p>{data.positioningId}</p></section>
    <section className="jiayin-panel"><h3>Lima kekuatan untuk peran ini</h3><div className="jiayin-english-pillars">{data.pillars.map((pillar, index) => <details key={pillar.id}><summary><span>{String(index + 1).padStart(2, '0')}</span>{pillar.title}</summary><p><strong>Bukti CV.</strong> {pillar.proof}</p><p><strong>Relevansi MT.</strong> {pillar.relevance}</p><p className="jiayin-source">{pillar.boundary}</p><button className="jiayin-secondary" onClick={() => open(englishPrepQuestions.find(q => q.pillar === pillar.id && q.id !== 'intro')!.id)}>Latih jawaban terkait</button></details>)}</div></section>
    <section className="jiayin-panel"><h3>Jalur utama untuk besok</h3><p>Coba jawab dahulu. Buka contoh bila perlu, isi bukti pribadimu, cek isi dalam Indonesia, lalu ulang tanpa skrip.</p><div className="jiayin-english-question-list">{core.map((question, index) => <QuestionLink key={question.id} question={question} index={index} ready={isEnglishPrepReady(question, latestEnglishAttempt(progress, question.id))} onClick={() => open(question.id)} />)}</div></section>
    <details className="jiayin-panel"><summary>Jelaskan semua bagian CV</summary><p>Baca ini sebelum memilih cerita. Siapkan masalah bisnis, tindakanmu, hasil, dan relevansi posisi.</p>{data.resume.map(entry => <details className="jiayin-worksheet" key={entry.id}><summary>{entry.title}</summary><small className="jiayin-source">{entry.period}</small><p>{entry.explain}</p><p>{entry.numbers}</p><p><strong>Siapkan jawaban:</strong> {entry.followup}</p><button className="jiayin-secondary" onClick={() => open(entry.question)}>Latih bagian CV ini</button></details>)}</details>
    <details className="jiayin-panel"><summary>Pertanyaan lanjutan dan studi kasus</summary><div className="jiayin-english-question-list">{englishPrepQuestions.filter(q => !q.priority).map((question, index) => <QuestionLink key={question.id} question={question} index={index} ready={isEnglishPrepReady(question, latestEnglishAttempt(progress, question.id))} onClick={() => open(question.id)} />)}</div></details>
    <details className="jiayin-panel"><summary>Pahami posisi dan pertanyaan balik</summary><p lang="en">{data.role.businessEn}</p><p>{data.role.summary}</p><p>{data.role.journeyId}</p><p>{data.role.tradeoffsId}</p><ol className="jiayin-curriculum-explanation">{data.role.tasks.map(task => <li key={task}>{task}</li>)}</ol><p className="jiayin-source">{data.role.confirm}</p>{data.backQuestions.map(question => <div className="jiayin-english-back-question" key={question.en}><p lang="en">{question.en}</p><small>{question.id}</small></div>)}</details>
    <details className="jiayin-panel"><summary>Rencana malam ini dan cek fakta</summary><ol className="jiayin-curriculum-explanation">{data.nightPlan.map(step => <li key={step}>{step}</li>)}</ol>{data.factChecks.map(fact => <p key={fact}>{fact}</p>)}<p className="jiayin-source">{jiayinData.interview.format} · {jiayinData.interview.time} · {jiayinData.interview.duration}. {jiayinData.interview.timezoneNote}</p></details>
    <div className="jiayin-actions"><a className="jiayin-secondary" href={PDF_URL} target="_blank" rel="noreferrer">PDF English + Indonesia<small>Versi cetak · 10 halaman · Mandarin di lampiran opsional</small></a><button className="jiayin-secondary" onClick={onMandarin}>Latihan Mandarin opsional<small>73 pelajaran HSK yang sudah ada, beserta audio dan catatanmu</small></button></div>
    <p className="jiayin-source">{data.sourceNote} Catatan dan jawaban tersimpan di perangkat ini.</p>
  </div>
}

function QuestionLink({ question, index, ready, onClick }: { question: EnglishPrepQuestion; index: number; ready: boolean; onClick: () => void }) {
  return <button className="jiayin-english-question" onClick={onClick}><span className="jiayin-unit-number">{String(index + 1).padStart(2, '0')}</span><span><strong lang="en">{question.questionEn}</strong><small>{question.title} · {question.seconds} detik{question.hypothetical ? ' · hipotetis' : ''}</small></span><span className="jiayin-english-status">{ready ? 'Siap' : 'Latih'}</span></button>
}

export function JiayinEnglishSession({ mode, onClose, onPlay }: { mode: string; onClose: () => void; onPlay: JiayinOpen }) {
  const { progress } = useJiayinEnglishProgress()
  const [queue] = useState(() => mode === 'english-mock' || mode === 'english-review'
    ? englishPrepQueue(englishPrepQuestions, progress, mode === 'english-mock' ? 'mock' : 'review')
    : englishPrepQuestions.filter(q => q.id === mode.slice('english:'.length)))
  const resumeId = `jiayin:${mode}`
  const [index, setIndex] = useState(() => Math.min(readStep(resumeId), Math.max(0, queue.length - 1)))
  const [done, setDone] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!done && queue.length) writeStep(resumeId, index) }, [index, done, resumeId, queue.length])
  useEffect(() => { body.current?.scrollTo({ top: 0 }) }, [index, done])
  const current = queue[index]
  function next() {
    if (index + 1 < queue.length) setIndex(i => i + 1)
    else { clearStep(resumeId); setDone(true) }
  }
  const nextQuestion = current ? nextEnglishQuestion(englishPrepQuestions, progress, current.id) : undefined
  return <div className="overlay session learning-session jiayin-overlay" role="dialog" aria-modal="true" aria-label="Latihan wawancara English">
    <div className="overlay-head"><button className="icon-round tap44" onClick={onClose} aria-label="Tutup latihan English"><CloseIcon /></button><div className="step-bar"><i style={{ width: `${done ? 100 : queue.length ? index / queue.length * 100 : 0}%` }} /></div><span className="jiayin-step-count">{queue.length ? `${done ? queue.length : index + 1}/${queue.length}` : '0'}</span></div>
    <div className="overlay-body jiayin-session jiayin-english-session" ref={body}>
      {done || !current ? <div className="jiayin-done"><span className="kicker-ink">LATIHAN ENGLISH</span><h2>{queue.length ? 'Jawaban dan evaluasimu tersimpan.' : 'Belum ada jawaban yang perlu diulang.'}</h2><p>Ulangi jawaban lemah tanpa membuka contoh. Ukuran kesiapan berasal dari penilaian isi olehmu; kemampuan bahasa dan fakta belum diperiksa otomatis.</p>{nextQuestion && <button className="btn" onClick={() => onPlay(0, `english:${nextQuestion.id}`)}>Latih pertanyaan berikutnya<small>{nextQuestion.title}</small></button>}<button className="jiayin-secondary" onClick={onClose}>Kembali ke persiapan</button></div>
      : <EnglishAnswerCard key={`${mode}:${current.id}`} question={current} onNext={next} />}
    </div>
  </div>
}

function EnglishAnswerCard({ question, onNext }: { question: EnglishPrepQuestion; onNext: () => void }) {
  const { progress, draft, note, record } = useJiayinEnglishProgress()
  const { progress: mandarinProgress } = useJiayinProgress()
  const current = progress.drafts[question.id] ?? { answer: '', assisted: false, checks: [] }
  const source = jiayinItems.find(item => item.id === question.sourceId)
  const previousEvidence = source ? jiayinEvidenceNotes(source.id, mandarinProgress, jiayinData.worksheets) : ''
  const [reference, setReference] = useState(false)
  const [chinese, setChinese] = useState(false)
  const [checking, setChecking] = useState(false)
  const [saved, setSaved] = useState(false)
  const [start, setStart] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (start === null || saved) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => window.clearInterval(timer)
  }, [start, saved])
  const evidence = englishEvidence(question, progress)
  const checksDone = question.criteria.every(check => current.checks.includes(check))
  const evidenceDone = evidence.every(text => !!text.trim())
  const canReady = !!current.answer.trim() && !current.assisted && checksDone && evidenceDone
  function reveal(which: 'reference' | 'chinese') {
    draft(question.id, { ...current, assisted: true })
    if (which === 'reference') setReference(true); else setChinese(true)
  }
  function save(rating: 'again' | 'supported' | 'ready') {
    if (!current.answer.trim() || (rating === 'ready' && !canReady)) return
    record(question.id, { ...current, at: Date.now(), seconds: elapsed, rating, evidence })
    setSaved(true)
    recordHistory({ course: 'jiayin', kind: 'node', lesson: 0, node: `english:${question.id}`, title: `English · ${question.title} · ${rating === 'ready' ? 'siap menurut penilaian diri' : 'perlu diulang'}` })
  }
  function retry() {
    draft(question.id, { answer: '', assisted: false, checks: [] })
    setReference(false); setChinese(false); setChecking(false); setSaved(false); setStart(null); setElapsed(0)
  }
  const last = latestEnglishAttempt(progress, question.id)
  return <div className="jiayin-teach jiayin-english-answer">
    <span className="kicker-ink">{question.hypothetical ? 'KASUS HIPOTETIS' : 'ENGLISH INTERVIEW'} · {question.title}</span>
    <h2 lang="en">{question.questionEn}</h2><p className="jiayin-english-intent">{question.questionId}</p>
    {!saved ? <>
      <div className="jiayin-timer" data-overtime={elapsed > question.seconds}><span>{elapsed}s / {question.seconds}s</span><button onClick={() => { if (start === null) setStart(Date.now() - elapsed * 1000); else { setElapsed(Math.floor((Date.now() - start) / 1000)); setStart(null) } }}>{start === null ? 'Mulai waktu jawaban' : 'Hentikan waktu'}</button></div>
      <label className="jiayin-answer-input">Jawaban English atau ringkasan jawaban lisan<textarea lang="en" rows={7} value={current.answer} onChange={event => draft(question.id, { ...current, answer: event.target.value })} placeholder="Jawab dengan pengalamanmu: business problem, your action, result, relevance." /></label>
      <div className="jiayin-actions"><button className="jiayin-secondary" onClick={() => reference ? setReference(false) : reveal('reference')}>{reference ? 'Tutup contoh' : 'Buka contoh & alur jawaban'}<small>Membuka contoh tercatat sebagai bantuan</small></button><button className="jiayin-secondary" onClick={() => chinese ? setChinese(false) : reveal('chinese')}>{chinese ? 'Tutup Mandarin' : 'Mandarin opsional'}<small>Pertanyaan sumber, pinyin dan audio</small></button></div>
      {reference && <section className="jiayin-reference"><span className="kicker-ink">CONTOH ENGLISH · SESUAIKAN DENGAN CERITAMU</span><p lang="en">{question.answerEn}</p><p>{question.coachId}</p><ol className="jiayin-curriculum-explanation">{question.outline.map(part => <li key={part}>{part}</li>)}</ol></section>}
      {chinese && source && <section className="jiayin-reference"><span className="kicker-ink">MANDARIN SUMBER TERKAIT · OPSIONAL</span><p lang="zh-CN">{source.questionZh}</p><p className="jiayin-pinyin">{source.questionPinyin}</p><HearButton text={source.questionZh} label="Dengar pertanyaan Mandarin" playingLabel="Sedang diputar" stopLabel="Hentikan" /><p lang="zh-CN">{source.answerZh}</p><p className="jiayin-pinyin">{source.chunkPinyin?.join(' ')}</p><HearButton text={source.answerZh} label="Dengar jawaban sumber" playingLabel="Sedang diputar" stopLabel="Hentikan" /><small>Materi Mandarin asli tetap tersedia; ini materi terkait, bukan terjemahan persis contoh English baru.</small></section>}
      <button className="btn" disabled={!current.answer.trim()} onClick={() => setChecking(true)}>Selesai menjawab · cek isi</button>
      {checking && <section className="jiayin-english-check"><h3>Periksa jawabanmu dalam Indonesia</h3><p>{question.coachId}</p><div className="jiayin-checklist">{question.criteria.map(check => <label key={check}><input type="checkbox" checked={current.checks.includes(check)} onChange={event => draft(question.id, { ...current, checks: event.target.checked ? [...current.checks, check] : current.checks.filter(value => value !== check) })} />{check}</label>)}</div>
        {!!question.evidenceFields.length && <div className="jiayin-english-evidence"><h3>Lengkapi bukti pribadi</h3><p>Isi kejadian asli agar jawaban bisa dijelaskan saat ditanya lanjut.</p>{question.evidenceFields.map((field, index) => <label className="jiayin-evidence-note" key={field}>{field}<textarea rows={2} value={evidence[index]} onChange={event => note(englishEvidenceKey(question.id, index), event.target.value)} /></label>)}{previousEvidence && <details onToggle={event => { if (event.currentTarget.open) draft(question.id, { ...current, assisted: true }) }}><summary>Catatan cerita dari latihan Mandarin sebelumnya</summary><p className="jiayin-english-preserve-lines">{previousEvidence}</p></details>}</div>}
        <p className="jiayin-source">{current.assisted ? 'Percobaan ini menggunakan bantuan. Ulangi tanpa contoh sebelum menandai siap mandiri.' : 'Nilai isi jawabanmu sendiri; aplikasi tidak menilai grammar atau memverifikasi pengalaman.'}</p>
        <div className="jiayin-ratings"><button disabled={!current.answer.trim()} onClick={() => save('again')}>Masih perlu diperbaiki</button><button disabled={!current.answer.trim()} onClick={() => save('supported')}>Isi cukup, perlu latihan ulang</button><button disabled={!canReady} onClick={() => save('ready')}>Siap mandiri menurut penilaian saya</button></div>
      </section>}
    </> : <section className="jiayin-english-result" aria-live="polite"><h3>{last && isEnglishPrepReady(question, last) ? 'Jawaban mandiri tersimpan.' : 'Jawaban tersimpan untuk dilatih ulang.'}</h3><p lang="en" className="jiayin-english-preserve-lines">{last?.answer}</p><p>{last?.assisted ? 'Contoh dibuka pada percobaan ini, jadi tidak dihitung sebagai mandiri.' : 'Kesiapan berdasarkan penilaianmu sendiri.'}</p><p><strong>Pertanyaan lanjutan:</strong> <span lang="en">{question.followupEn}</span></p><button className="btn" onClick={retry}>Ulangi pertanyaan tanpa contoh</button><button className="jiayin-secondary" onClick={onNext}>Lanjut</button></section>}
  </div>
}
