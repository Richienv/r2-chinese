import { useEffect, useMemo, useRef, useState } from 'react'
import { CloseIcon } from '../components/Icons'
import { HearButton } from '../components/Hear'
import { Sheet } from '../components/Sheet'
import { jiayinData, jiayinItems, jiayinUnits, useJiayinProgress } from '../lib/jiayin'
import {
  answerChunks, buildJiayinQuiz, isJiayinAssemblyCorrect, isJiayinRetained, isUnaidedAttempt,
  jiayinBuildParts, jiayinEvidenceNotes, jiayinRecallPrompt, JIAYIN_STAGES, JIAYIN_STAGE_LABEL, lastJiayinAttempt,
  needsJiayinReview, nextJiayinStage, passesJiayinCheck, passesJiayinRecall,
  selectJiayinMock, selectJiayinReview, shuffledJiayinParts,
  type JiayinItem, type JiayinStage, type JiayinUnit, type JiayinWord,
} from '../lib/jiayinPractice'
import { createMandarinRecognition, type RecognitionSnapshot } from '../lib/recognition'
import { recordHistory } from '../lib/history'
import { clearStep, readStep, writeStep } from '../lib/resume'
import { useStore } from '../store/store'
import '../styles/jiayin.css'

export type JiayinSessionMode = JiayinStage | 'mock' | 'review'
export type JiayinOpen = (unit: number, stage: JiayinSessionMode) => void

export function JiayinPath({ onPlay }: { onPlay: JiayinOpen }) {
  const { progress, note } = useJiayinProgress()
  const next = nextJiayinStage(jiayinUnits, progress)
  const [word, setWord] = useState<JiayinWord | null>(null)
  const questions = jiayinItems.filter(item => item.id.startsWith('q'))
  const unaided = questions.filter(item => isUnaidedAttempt(lastJiayinAttempt(progress.attempts[item.id]))).length
  const retained = questions.filter(item => isJiayinRetained(progress.attempts[item.id])).length
  const due = jiayinItems.filter(item => (item.id.startsWith('q') || item.hypothetical) && needsJiayinReview(item, progress)).length
  const completed = jiayinUnits.reduce((n, u) => n + JIAYIN_STAGES.filter(s => progress.pathDone[String(u.id)]?.includes(s)).length, 0)
  return (
    <div className="jiayin-path">
      <section className="jiayin-hero">
        <span className="kicker-ink">嘉银 · Fokus wawancara · 15 Oktober 2026</span>
        <h2>Pahami maksudnya. Jawab dengan bukti.</h2>
        <p>16 unit bertahap · 48 pertanyaan · 6 studi kasus. Seluruh penjelasan dalam bahasa Indonesia, dengan Mandarin dan pinyin untuk latihan.</p>
        <button className="btn" onClick={() => onPlay(next.unit, next.stage)}>
          Lanjut: {JIAYIN_STAGE_LABEL[next.stage]}<small>{jiayinUnits.find(u => u.id === next.unit)?.title}</small>
        </button>
        <div className="jiayin-summary"><span>{completed}/{jiayinUnits.length * JIAYIN_STAGES.length} tahap selesai</span><span>{unaided}/48 jawaban mandiri*</span><span>{retained}/48 konsisten lintas hari*</span></div>
        <small>*Penilaian diri. Konsisten = jawaban mandiri pada sedikitnya dua hari berbeda; bukan skor pelafalan.</small>
      </section>
      <div className="jiayin-learning-route" aria-label="Urutan belajar">{JIAYIN_STAGES.map((stage, index) => <span key={stage}><b>{index + 1}</b>{JIAYIN_STAGE_LABEL[stage]}</span>)}</div>
      <div className="jiayin-actions">
        <button className="jiayin-secondary" onClick={() => onPlay(0, 'mock')}>Simulasi wawancara<small>12 pertanyaan + 3 kasus · pengukur waktu</small></button>
        <button className="jiayin-secondary" onClick={() => onPlay(0, 'review')}>Ulangi bagian yang lemah<small>{due} latihan perlu dikerjakan atau diulang</small></button>
      </div>
      <details className="jiayin-panel">
        <summary>Rencana sampai Kamis</summary>
        {jiayinData.plan.map(day => <div className="jiayin-plan-day" key={day.date}><strong>{day.date.slice(8)} Oktober · {day.title}</strong><p>{day.task}</p></div>)}
        <p className="jiayin-source">{jiayinData.interview.format} · {jiayinData.interview.time} · {jiayinData.interview.duration}. {jiayinData.interview.timezoneNote}</p>
      </details>
      <section className="jiayin-units" aria-label="Kurikulum Jiayin">
        {jiayinUnits.map(unit => {
          const done = progress.pathDone[String(unit.id)] ?? []
          return <details className="jiayin-panel jiayin-unit" key={unit.id} open={unit.id === next.unit || undefined}>
            <summary><span className="jiayin-unit-number">{String(unit.id).padStart(2, '0')}</span><span>{unit.title}<small>{unit.items.length} latihan · {JIAYIN_STAGES.filter(s => done.includes(s)).length}/{JIAYIN_STAGES.length} tahap</small></span></summary>
            <p className="jiayin-unit-goal">{unit.teaching.goal}</p>
            <div className="jiayin-stage-buttons">{JIAYIN_STAGES.map(stage => <button key={stage} data-done={done.includes(stage)} data-next={next.unit === unit.id && next.stage === stage} onClick={() => onPlay(unit.id, stage)}>{done.includes(stage) ? '✓ ' : ''}{JIAYIN_STAGE_LABEL[stage]}</button>)}</div>
          </details>
        })}
      </section>
      <details className="jiayin-panel"><summary>Cerita nyata dan bukti pribadi</summary>
        <p>Isi dari pengalaman asli. Catatan disimpan otomatis di perangkat ini.</p>
        {jiayinData.worksheets.map(sheet => <details className="jiayin-worksheet" key={sheet.id}><summary>{sheet.title}</summary>{sheet.fields.map((field, index) => {
          const key = `worksheet:${sheet.id}:${index}`
          return <label key={key}>{field}<textarea value={progress.notes[key] ?? ''} onChange={e => note(key, e.target.value)} rows={2} /></label>
        })}</details>)}
      </details>
      <details className="jiayin-panel"><summary>Fakta yang harus konsisten</summary>{jiayinData.facts.map(fact => <p key={fact}>{fact}</p>)}</details>
      <details className="jiayin-panel"><summary>Perusahaan dan posisi · dari PDF</summary><p className="jiayin-source">{jiayinData.source.note}</p>
        {jiayinData.company.map(section => <details key={section.heading} className="jiayin-worksheet"><summary>{section.heading}</summary><p lang="zh-CN">{section.zh}</p><p>{section.id}</p><small>PDF hlm. {section.page} · {section.source}</small></details>)}
      </details>
      <details className="jiayin-panel"><summary>Bank kosakata · 25 kata</summary><div className="jiayin-vocab-bank">{Array.from(new Map(jiayinUnits.flatMap(u => u.vocab).map(w => [w.zh, w])).values()).map(w => <button key={w.zh} onClick={() => setWord(w)}><strong lang="zh-CN">{w.zh}</strong><small>{w.pinyin}</small><span>{w.id}</span></button>)}</div></details>
      <p className="jiayin-source">{jiayinData.teachingNote} Sumber: {jiayinData.source.filename} · 31 halaman. Kemajuan dan catatan tersimpan di perangkat ini.</p>
      {word && <WordSheet word={word} onClose={() => setWord(null)} />}
    </div>
  )
}

function WordSheet({ word, onClose }: { word: JiayinWord; onClose: () => void }) {
  const example = jiayinItems.find(item => item.answerZh.includes(word.zh))
  const chunkIndex = example ? answerChunks(example.answerZh).findIndex(chunk => chunk.includes(word.zh)) : -1
  const line = example && answerChunks(example.answerZh)[chunkIndex]
  return <Sheet label={`Kosakata ${word.zh}`} onClose={onClose}><div className="jiayin-word-sheet"><h2 lang="zh-CN">{word.zh}</h2><p>{word.pinyin}</p><p>{word.id}</p><p>{word.tip}</p>{line && <><p lang="zh-CN">{line}</p><p>{example?.chunkId[chunkIndex]}</p><small>Kalimat dari PDF hlm. {example?.page}</small></>}<HearButton playingLabel="Sedang diputar" stopLabel="Hentikan" text={word.zh} label="Dengar kata" /></div></Sheet>
}

export function JiayinSession({ unit: unitId, stage, onClose, onPlay }: { unit: number; stage: JiayinSessionMode; onClose: () => void; onPlay: JiayinOpen }) {
  const { progress, complete } = useJiayinProgress()
  const store = useStore()
  const unit = jiayinUnits.find(u => u.id === unitId)
  const items = useMemo(() => stage === 'mock' ? selectJiayinMock(jiayinItems, progress)
    : stage === 'review' ? selectJiayinReview(jiayinItems, progress)
      : unit?.items ?? [], [unitId, stage])
  const quizzes = useMemo(() => unit ? buildJiayinQuiz(unit) : [], [unit])
  const length = stage === 'context' ? unit ? 1 : 0 : stage === 'words' ? unit?.vocab.length ?? 0 : stage === 'test' ? quizzes.length : items.length
  const resumeId = `jiayin:${unitId}:${stage}`
  const [index, setIndex] = useState(() => stage === 'mock' || stage === 'review' ? 0 : Math.min(readStep(resumeId), Math.max(0, length - 1)))
  const [done, setDone] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [word, setWord] = useState<JiayinWord | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  const tested = stage === 'test' || stage === 'build'
  const passed = tested ? passesJiayinCheck(results, length) : stage === 'recall' ? passesJiayinRecall(items, progress, jiayinData.worksheets) : true
  const score = results.filter(Boolean).length
  useEffect(() => { if (!done && !tested && stage !== 'mock' && stage !== 'review') writeStep(resumeId, index); body.current?.scrollTo({ top: 0 }) }, [index, done, resumeId, stage, tested])
  // Checkpoints restart on reopen so reload cannot erase earlier mistakes from a test score.
  useEffect(() => { if (tested) { setIndex(0); clearStep(resumeId) } }, [tested, resumeId])
  useEffect(() => {
    if (!done || finished.current) return
    finished.current = true
    clearStep(resumeId)
    if (passed && stage !== 'review') complete(unitId, stage)
    recordHistory({ course: 'jiayin', kind: !passed ? 'quiz' : 'node', lesson: unitId, node: stage, correct: tested || stage === 'recall' ? passed : undefined, title: stage === 'mock' ? 'Simulasi wawancara Jiayin' : stage === 'review' ? 'Pengulangan Jiayin' : `${unit?.title} · ${JIAYIN_STAGE_LABEL[stage]}${tested || stage === 'recall' ? passed ? ' · lulus' : ' · perlu diulang' : ''}` })
    if (passed && stage !== 'mock' && stage !== 'review' && !progress.pathDone[String(unitId)]?.includes(stage)) store.awardXp(15)
  }, [done, passed, resumeId, stage, unitId])
  function advance(correct?: boolean) {
    if (correct !== undefined) setResults(old => [...old, correct])
    store.practiceLog()
    if (index + 1 >= length) setDone(true)
    else setIndex(i => i + 1)
  }
  if (!length || (!unit && stage !== 'mock' && stage !== 'review')) return <div className="overlay session"><div className="overlay-body jiayin-session"><h2>Latihan hari ini sudah tercatat.</h2><p>Jawaban mandiri akan kembali untuk pengulangan setelah 1, 2, atau 4 hari sesuai hasil latihan lintas hari.</p><button className="btn" onClick={onClose}>Kembali</button></div></div>
  const title = stage === 'mock' ? 'Simulasi wawancara' : stage === 'review' ? 'Latih ulang' : `${unit?.title}`
  const currentWord = unit?.vocab[index]
  return <div className="overlay session learning-session jiayin-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <div className="overlay-head"><button className="icon-round tap44" aria-label="Tutup latihan Jiayin" onClick={onClose}><CloseIcon /></button><div className="step-bar"><i style={{ width: `${done ? 100 : index / length * 100}%` }} /></div><span className="jiayin-step-count">{done ? length : index + 1}/{length}</span></div>
    <div className="overlay-body jiayin-session" ref={body}>
      <div className="jiayin-session-label">{title} · {stage === 'mock' || stage === 'review' ? 'Jawab mandiri' : JIAYIN_STAGE_LABEL[stage]}</div>
      {done ? <div className="jiayin-done"><h2>{!passed ? 'Bagian ini masih perlu dilatih.' : tested ? 'Tahap lulus.' : 'Latihan selesai.'}</h2>
        <p>{tested ? `${score}/${length} benar pada percobaan pertama. Minimal 80% untuk menyelesaikan tahap.` : stage === 'recall' ? passed ? 'Semua jawaban dalam unit ini tercatat mandiri berdasarkan penilaianmu. Ulangi pada hari berbeda untuk menguji daya ingat.' : 'Jawaban tersimpan, tetapi tahap mandiri belum selesai. Jawab semua pertanyaan tanpa referensi dengan kriteria isi terpenuhi.' : stage === 'context' || stage === 'words' || stage === 'answers' ? 'Tahap belajar tersimpan. Lanjutkan ke latihan berikutnya untuk menguji pemahaman dan kemampuan menjawab.' : 'Jawaban dan penilaian diri tersimpan. Pengulangan mengutamakan jawaban lemah, lalu materi yang jatuh tempo.'}</p>
        {stage === 'mock' && <p>Waktu membantu mengatur penyampaian; isi dan kelancaran dinilai sendiri. Lengkapi cerita nyata bila bukti masih kurang.</p>}
        <button className="btn" onClick={() => { if (!passed) { finished.current = false; setDone(false); setResults([]); setIndex(0) } else if (unit && stage !== 'mock' && stage !== 'review') { const nextStage = JIAYIN_STAGES[JIAYIN_STAGES.indexOf(stage) + 1]; nextStage ? onPlay(unitId, nextStage) : onClose() } else onClose() }}>{!passed ? 'Latih tahap ini lagi' : unit && stage !== 'test' ? 'Tahap berikutnya' : 'Kembali ke kurikulum'}</button>
      </div> : stage === 'context' && unit ? <ContextLesson unit={unit} onNext={() => advance()} />
        : stage === 'words' && currentWord ? <WordLesson key={currentWord.zh} word={currentWord} onDetail={() => setWord(currentWord)} onNext={() => advance()} />
          : stage === 'build' ? <BuildCard key={items[index].id} item={items[index]} onNext={advance} />
        : stage === 'test' ? <QuizCard key={quizzes[index].id} quiz={quizzes[index]} unitId={unitId} onNext={advance} />
          : stage === 'answers' && unit ? <AnswerLesson key={items[index].id} item={items[index]} pattern={unit.pattern} first={index === 0} words={unit.vocab} onWord={setWord} onNext={() => advance()} />
            : <RecallCard key={`${stage}:${items[index].id}`} item={items[index]} mock={stage === 'mock'} onNext={() => advance()} />}
    </div>
    {word && <WordSheet word={word} onClose={() => setWord(null)} />}
  </div>
}

function DisplayControls({ pinyin, translation, onPinyin, onTranslation }: { pinyin: boolean; translation: boolean; onPinyin: () => void; onTranslation: () => void }) {
  return <div className="jiayin-display" role="group" aria-label="Bantuan baca"><button aria-pressed={pinyin} onClick={onPinyin}>Pinyin {pinyin ? 'tampil' : 'sembunyi'}</button><button aria-pressed={translation} onClick={onTranslation}>Arti Indonesia {translation ? 'tampil' : 'sembunyi'}</button></div>
}

function ContextLesson({ unit, onNext }: { unit: JiayinUnit; onNext: () => void }) {
  const lesson = unit.teaching
  return <div className="jiayin-teach">
    <span className="kicker-ink">Tujuan unit {unit.id}</span><h2>{lesson.goal}</h2>
    <div className="jiayin-context-block"><h3>Situasi yang akan kamu hadapi</h3><p>{lesson.scenario}</p></div>
    <div className="jiayin-context-block"><h3>Yang dinilai pewawancara</h3><p>{lesson.reason}</p></div>
    <div className="jiayin-context-block"><h3>Alur berpikir</h3><ol>{lesson.route.map(step => <li key={step}>{step}</li>)}</ol></div>
    <div className="jiayin-coach"><h3>Jaga ketepatan jawaban</h3>{lesson.pitfalls.map(pitfall => <p key={pitfall}>{pitfall}</p>)}</div>
    <p>{lesson.task}</p><button className="btn" onClick={onNext}>Mulai pelajari kosakata</button>
  </div>
}

function WordLesson({ word, onDetail, onNext }: { word: JiayinWord; onDetail: () => void; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false)
  return <div className="jiayin-teach"><span className="kicker-ink">Kosakata · PDF hlm. {word.page}</span><h2 className="jiayin-word" lang="zh-CN">{word.zh}</h2><p>Sebutkan artinya dahulu. Bayangkan kapan kamu memakai kata ini dalam wawancara.</p>
    {!revealed ? <button className="jiayin-secondary" onClick={() => setRevealed(true)}>Buka arti dan cara mengingat</button> : <>
      <p className="jiayin-pinyin">{word.pinyin}</p><h3>{word.id}</h3><p>{word.tip}</p><HearButton playingLabel="Sedang diputar" stopLabel="Hentikan" text={word.zh} label="Dengar dan tirukan" />
      <button className="jiayin-secondary" onClick={onDetail}>Contoh Mandarin dan arti Indonesia</button>
    </>}
    <button className="btn" disabled={!revealed} onClick={onNext}>Lanjut</button>
  </div>
}

function BuildCard({ item, onNext }: { item: JiayinItem; onNext: (correct: boolean) => void }) {
  const parts = useMemo(() => jiayinBuildParts(item), [item])
  const order = useMemo(() => shuffledJiayinParts(parts, item.id), [parts, item.id])
  const [selected, setSelected] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const [firstResult, setFirstResult] = useState<boolean | null>(null)
  const correct = isJiayinAssemblyCorrect(parts, selected, item.answerZh)
  function check() { setChecked(true); if (firstResult === null) setFirstResult(correct) }
  return <div className="jiayin-teach jiayin-build"><span className="kicker-ink">Susun mengikuti alur contoh · PDF hlm. {item.page}</span>
    <h2>{item.questionId}</h2>{item.answerId !== item.questionId && <p>{item.answerId}</p>}
    <p className="jiayin-source">Pilih potongan Mandarin sesuai urutan contoh yang telah dipelajari. Latihan ini menguji struktur referensi; susunan jawaban bebas dapat berbeda.</p>
    <div className="jiayin-built-answer" aria-label="Jawaban yang disusun" aria-live="polite">{!selected.length && <span>Pilih potongan pertama di bawah.</span>}{selected.map((partIndex, index) => <button lang="zh-CN" key={partIndex} disabled={checked} aria-label={`Hapus potongan ${index + 1}: ${parts[partIndex]}`} onClick={() => setSelected(old => old.filter(i => i !== partIndex))}><small>{index + 1}</small>{parts[partIndex]}</button>)}</div>
    <div className="jiayin-build-bank" aria-label="Potongan Mandarin">{order.map(partIndex => <button key={partIndex} lang="zh-CN" disabled={selected.includes(partIndex) || checked} onClick={() => setSelected(old => [...old, partIndex])}>{parts[partIndex]}</button>)}</div>
    {!checked ? <><button className="jiayin-secondary" disabled={!selected.length} onClick={() => setSelected([])}>Susun ulang</button><button className="btn" disabled={selected.length !== parts.length} onClick={check}>Periksa susunan</button></> : <>
      <div className="jiayin-feedback" role="status"><strong>{correct ? 'Alur contoh tersusun tepat.' : 'Urutan belum sesuai contoh.'}</strong><p>{item.intent}</p><p>{item.coach}</p>{!correct && <p>{item.buildHint}</p>}{correct && firstResult === false && <p>Koreksi sudah dipelajari. Percobaan pertama tetap tercatat perlu diulang.</p>}</div>
      {!correct ? <><button className="jiayin-secondary" onClick={() => { setSelected([]); setChecked(false) }}>Coba susun kembali</button><button className="jiayin-secondary" onClick={() => setSelected(parts.map((_, i) => i))}>Pelajari susunan contoh</button></> : <button className="btn" onClick={() => onNext(firstResult === true)}>Lanjut</button>}
    </>}
  </div>
}

function AnswerLesson({ item, pattern, first, words, onWord, onNext }: { item: JiayinItem; pattern: (typeof jiayinUnits)[number]['pattern']; first: boolean; words: JiayinWord[]; onWord: (word: JiayinWord) => void; onNext: () => void }) {
  const [shown, setShown] = useState(1)
  const [translation, setTranslation] = useState(true)
  const [pinyin, setPinyin] = useState(true)
  const chunks = answerChunks(item.answerZh)
  return <div className="jiayin-teach"><span className="kicker-ink">{item.number ? `Pertanyaan ${item.number}` : 'Latihan'} · PDF hlm. {item.page}{item.hypothetical ? ' · hipotetis' : ''}</span><h2 lang="zh-CN">{item.questionZh}</h2>{translation && <p>{item.questionId}</p>}
    {pinyin && item.questionPinyin && <p className="jiayin-pinyin">{item.questionPinyin}</p>}
    <div className="jiayin-context-block"><h3>Maksud pertanyaan</h3><p>{item.intent}</p></div>
    <DisplayControls pinyin={pinyin} translation={translation} onPinyin={() => setPinyin(!pinyin)} onTranslation={() => setTranslation(!translation)} />
    {first && <details className="jiayin-pattern"><summary>Pola kalimat: {pattern.form}</summary><p lang="zh-CN">{pattern.zh}</p>{pinyin && <p className="jiayin-pinyin">{pattern.pinyin}</p>}<p>{pattern.explanation}</p><small>{pattern.pinyinSource}</small></details>}
    <div className="jiayin-answer-chunks">{chunks.slice(0, shown).map((chunk, i) => <div className="jiayin-answer-line" key={i}><small>Kalimat {i + 1} dari {chunks.length}</small><p lang="zh-CN">{highlightWords(chunk, words, onWord)}</p>{pinyin && item.chunkPinyin?.[i] && <p className="jiayin-pinyin">{item.chunkPinyin[i]}</p>}{translation && <p className="jiayin-line-meaning">{item.chunkId[i]}</p>}<HearButton playingLabel="Sedang diputar" stopLabel="Hentikan" text={chunk} label={`Dengar kalimat ${i + 1}`} /></div>)}</div>
    {pinyin && <small className="jiayin-source">{item.pinyinSource}</small>}
    {shown < chunks.length ? <button className="jiayin-secondary" onClick={() => setShown(n => n + 1)}>Buka kalimat berikutnya · {shown}/{chunks.length}</button> : <>
      {translation && <div className="jiayin-translation"><span>Makna dan konteks jawaban</span><p>{item.answerId}</p></div>}
      <p className="jiayin-coach">{item.coach}</p>
      <div className="jiayin-context-block"><h3>Uji dengan pertanyaan lanjutan</h3><p>{item.followup}</p><small>Latihan pengajaran, bukan pertanyaan yang dipastikan akan muncul.</small></div>
      {item.needsEvidence && <p className="jiayin-evidence">Tambahkan pengalaman asli di tahap “Jawab mandiri”. Ini struktur jawaban, belum menjadi bukti pribadi.</p>}
      <HearButton playingLabel="Sedang diputar" stopLabel="Hentikan" text={item.answerZh} label="Dengar jawaban" />
    </>}
    <button className="btn" disabled={shown < chunks.length} onClick={onNext}>Lanjut</button>
  </div>
}
function highlightWords(text: string, words: JiayinWord[], onWord: (word: JiayinWord) => void) {
  const pattern = new RegExp(`(${words.map(w => w.zh).sort((a, b) => b.length - a.length).join('|')})`, 'g')
  return text.split(pattern).map((part, index) => { const word = words.find(w => w.zh === part); return word ? <button key={index} className="jiayin-inline-word" aria-label={`Arti ${part}`} onClick={() => onWord(word)}>{part}</button> : <span key={index}>{part}</span> })
}

function QuizCard({ quiz, unitId, onNext }: { quiz: ReturnType<typeof buildJiayinQuiz>[number]; unitId: number; onNext: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const correct = picked === quiz.answer
  return <div className="jiayin-teach"><span className="kicker-ink">Tanpa pinyin dan petunjuk</span><h2>{quiz.prompt}</h2><div className="jiayin-options">{quiz.choices.map((choice, index) => <button key={choice} disabled={picked !== null} data-picked={picked === index} data-correct={picked !== null && index === quiz.answer} onClick={() => { setPicked(index); recordHistory({ course: 'jiayin', kind: 'quiz', lesson: unitId, node: quiz.id, correct: index === quiz.answer }) }}>{choice}</button>)}</div>{picked !== null && <div className="jiayin-feedback" role="status"><strong>{correct ? 'Benar.' : 'Perlu diulang.'}</strong><p>{quiz.explanation}</p></div>}<button className="btn" disabled={picked === null} onClick={() => onNext(correct)}>Lanjut</button></div>
}

function RecallCard({ item, mock, onNext }: { item: JiayinItem; mock: boolean; onNext: () => void }) {
  const { progress, note, attempt } = useJiayinProgress()
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const assistanceKey = `pending-assistance:${item.id}`
  const [assisted, setAssisted] = useState(progress.notes[assistanceKey] === '1')
  const [submitted, setSubmitted] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [speech, setSpeech] = useState<RecognitionSnapshot>({ status: 'idle', interim: '', error: '' })
  const mic = useRef<ReturnType<typeof createMandarinRecognition> | null>(null)
  const timerStarted = useRef(0)
  const noteKey = `answer:${item.id}`
  const [ownNotes, setOwnNotes] = useState(() => jiayinEvidenceNotes(item.id, progress, jiayinData.worksheets))
  const followupKey = `followup:${item.id}`
  const [notesOpen, setNotesOpen] = useState(false)
  useEffect(() => {
    mic.current = createMandarinRecognition({ language: 'id', onState: setSpeech, onFinal: text => setAnswer(text) })
    return () => mic.current?.dispose()
  }, [])
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - timerStarted.current) / 1000)), 250)
    return () => clearInterval(timer)
  }, [running])
  const checklist = item.criteria
  const prompt = jiayinRecallPrompt(item)
  function useAssistance() { setAssisted(true); note(assistanceKey, '1') }
  function reveal() { setRevealed(true); if (!submitted) useAssistance() }
  function save(rating: 1 | 2 | 3) {
    if (item.needsEvidence && ownNotes.trim()) note(noteKey, ownNotes)
    attempt(item.id, { at: Date.now(), rating, assisted, answer, seconds: elapsed })
    note(assistanceKey, '')
    setSubmitted(true)
    setRunning(false)
    mic.current?.cancel()
  }
  return <div className="jiayin-teach jiayin-recall"><span className="kicker-ink">{mock ? 'Simulasi' : 'Jawab mandiri'} · {item.number ? `Pertanyaan ${item.number}` : item.hypothetical ? 'Kasus hipotetis' : 'Latihan'} · {item.seconds} detik</span><h2 lang={prompt.language}>{prompt.text}</h2>
    <div className="jiayin-timer" data-overtime={elapsed > item.seconds}><span aria-live="off">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} / {Math.floor(item.seconds / 60)}:{String(item.seconds % 60).padStart(2, '0')}</span><button disabled={submitted} onClick={() => { timerStarted.current = Date.now() - elapsed * 1000; setRunning(!running) }}>{running ? 'Jeda' : 'Mulai waktu'}</button></div>
    {!submitted && <>
      <p className="jiayin-instruction">{prompt.language === 'id' ? 'Sampaikan frasa atau pertanyaan ini dalam Mandarin tanpa melihat contoh.' : 'Jawab dulu tanpa skrip.'} Bicara lalu catat inti Mandarin, atau gunakan mikrofon untuk transkripsi.</p>
      <button className="jiayin-secondary" onClick={() => { if (speech.status === 'listening' || speech.status === 'starting') mic.current?.stop(); else mic.current?.start() }}>{speech.status === 'listening' || speech.status === 'starting' ? 'Hentikan mikrofon' : 'Jawab dengan mikrofon'}</button>
      {speech.interim && <p role="status">{speech.interim}</p>}{speech.error && <p className="jiayin-source" role="status">{speech.error}</p>}
    </>}
    <label className="jiayin-answer-input">Jawaban / inti yang kamu sampaikan<textarea lang="zh-CN" value={answer} disabled={submitted} rows={5} onChange={e => setAnswer(e.target.value)} placeholder="用中文回答…" /></label>
    <button className="jiayin-secondary" onClick={reveal}>{revealed ? 'Jawaban referensi terbuka' : submitted ? 'Bandingkan dengan referensi' : 'Butuh bantuan / lihat referensi'}</button>
    {revealed && <div className="jiayin-reference"><p>{item.questionId}</p><p lang="zh-CN">{item.answerZh}</p>{item.pinyin && <p className="jiayin-pinyin">{item.pinyin}</p>}<p>{item.answerId}</p><p className="jiayin-coach">{item.coach}</p></div>}
    {item.needsEvidence && <div className="jiayin-evidence-note"><button className="jiayin-secondary" onClick={() => { setNotesOpen(!notesOpen); if (!submitted) useAssistance() }}>Cerita / pengukuran asli{ownNotes.trim() ? ' · sudah tersimpan' : ' · wajib diisi'}</button>{notesOpen && <label>Detail asli untuk pertanyaan ini<textarea rows={4} value={ownNotes} onChange={e => { setOwnNotes(e.target.value); note(noteKey, e.target.value) }} placeholder="Situasi → tanggung jawab → tindakan pribadi → bukti hasil → pelajaran" /><small>Disimpan di perangkat ini. Membuka catatan sebelum menilai dihitung sebagai bantuan.</small></label>}</div>}
    {!submitted ? <><div className="jiayin-checklist">{checklist.map(label => <label key={label}><input type="checkbox" checked={checked.includes(label)} onChange={e => setChecked(old => e.target.checked ? [...old, label] : old.filter(v => v !== label))} />{label}</label>)}</div><p className="jiayin-source">Penilaian diri: nilai isi dan kelancaran penyampaianmu, bukan kecocokan kata persis. {assisted ? 'Percobaan ini tercatat memakai bantuan.' : 'Referensi belum dibuka.'}</p><div className="jiayin-ratings"><button disabled={!answer.trim()} onClick={() => save(1)}>Masih macet</button><button disabled={!answer.trim()} onClick={() => save(2)}>Perlu latihan</button><button disabled={!answer.trim() || checked.length !== checklist.length || (item.needsEvidence && !ownNotes.trim())} onClick={() => save(3)}>{assisted ? 'Bisa dengan bantuan' : 'Bisa mandiri'}</button></div></> : <><p className="jiayin-feedback" role="status">Percobaan tersimpan{assisted ? ' · dengan bantuan' : ' · tanpa referensi'}. Bandingkan isi jawaban dan latih lagi pada hari berbeda.</p>
      <details className="jiayin-pattern"><summary>Latihan pertanyaan lanjutan</summary><p>{item.followup}</p><label>Jawab dalam Mandarin dengan pengalaman atau analisis sendiri<textarea lang="zh-CN" rows={3} value={progress.notes[followupKey] ?? ''} onChange={e => note(followupKey, e.target.value)} placeholder="用中文回答…" /></label><small>Catatan latihan tersimpan otomatis; tidak menambah skor jawaban mandiri.</small></details>
      <button className="btn" onClick={onNext}>Pertanyaan berikutnya</button></>}
  </div>
}
