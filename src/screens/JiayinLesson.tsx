import { useEffect, useMemo, useRef, useState } from 'react'
import { CloseIcon } from '../components/Icons'
import { HearButton } from '../components/Hear'
import { WordRecall } from '../components/WordRecall'
import { ResponsePractice } from '../components/ProductionPractice'
import { StrokeWord } from '../components/StrokeWord'
import { jiayinData, jiayinLessons, useJiayinProgress } from '../lib/jiayin'
import { answerChunks, jiayinEvidenceNotes, type JiayinQuiz, type JiayinWord } from '../lib/jiayinPractice'
import { appendJiayinRetry, asJiayinVocab, buildJiayinLessonSteps, isJiayinExerciseIndependent, jiayinAnswerExample, jiayinExerciseKey, jiayinLessonPrompt, jiayinLessonReviewSteps, jiayinSentence, JIAYIN_LEARNING_STAGES, lastJiayinExercise, type JiayinLesson, type JiayinLessonStep } from '../lib/jiayinLesson'
import { clearLearningCheckpoint, readLearningCheckpoint, writeLearningCheckpoint } from '../lib/resume'
import { recordHistory } from '../lib/history'
import type { ProductionAssessment, ProductionResult } from '../lib/production'
import { playAdvance, playComplete } from '../lib/sfx'
import { stopSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/jiayin.css'

export function JiayinLessonSession({ itemId, review = false, onClose, onNextLesson }: {
  itemId: string; review?: boolean; onClose: () => void; onNextLesson: (lesson: JiayinLesson) => void
}) {
  const lesson = jiayinLessons.find(candidate => candidate.id === itemId)
  if (!lesson) return <div className="overlay session"><div className="overlay-body"><p>Pelajaran tidak ditemukan.</p><button className="btn" onClick={onClose}>Kembali</button></div></div>
  return <LessonRunner lesson={lesson} review={review} onClose={onClose} onNextLesson={onNextLesson} />
}

function LessonRunner({ lesson, review, onClose, onNextLesson }: {
  lesson: JiayinLesson; review: boolean; onClose: () => void; onNextLesson: (lesson: JiayinLesson) => void
}) {
  const { progress, exercise, finishLesson, note, attempt } = useJiayinProgress()
  const store = useStore()
  const resumeId = `jiayin:hsk-loop:v1:${lesson.id}:${review ? 'review' : 'learn'}`
  const checkpoint = useRef(readLearningCheckpoint(resumeId))
  const retryIds = useRef(new Set(checkpoint.current?.retryWords ?? []))
  const [steps, setSteps] = useState<JiayinLessonStep[]>(() => {
    const base = buildJiayinLessonSteps(lesson)
    if (review) return [...jiayinLessonReviewSteps(lesson, progress), base[base.length - 1]]
    return [...retryIds.current].reduce((list, id) => {
      const step = base.find(candidate => candidate.id === id)
      return step ? appendJiayinRetry(list, step) : list
    }, base)
  })
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex(step => step.id === checkpoint.current?.stepId)))
  const [checked, setChecked] = useState(false)
  const [done, setDone] = useState(false)
  const [xp, setXp] = useState(0)
  const body = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  const credited = useRef(new Set<string>())
  const initialProgress = useRef(progress)
  const step = steps[index] ?? steps[steps.length - 1]
  const complete = step.kind === 'complete'
  const aidKey = `guided-assistance:${step.id}`
  const assisted = progress.notes[aidKey] === '1'
  const words = useMemo(() => lesson.words.map(asJiayinVocab), [lesson])
  const glosses = useMemo(() => Object.fromEntries(lesson.words.map(word => [word.zh, word.id])), [lesson])
  const assessedSteps = steps.filter(candidate => ['word', 'sentence', 'answer', 'check'].includes(candidate.kind) && !candidate.id.startsWith('retry:'))
  const independent = assessedSteps.filter(candidate => isJiayinExerciseIndependent(lastJiayinExercise(progress, candidate.id))).length
  const open = assessedSteps.filter(candidate => !isJiayinExerciseIndependent(lastJiayinExercise(progress, candidate.id)))
  const nextLesson = jiayinLessons[jiayinLessons.findIndex(candidate => candidate.id === lesson.id) + 1]

  useEffect(() => { body.current?.scrollTo({ top: 0 }); setChecked(false); stopSpeech() }, [step.id])
  useEffect(() => {
    if (!complete) writeLearningCheckpoint(resumeId, { stepId: step.id, retryWords: [...retryIds.current], assistedSteps: [] })
  }, [step.id, steps, complete, resumeId])
  useEffect(() => {
    if (!complete || finished.current) return
    finished.current = true
    clearLearningCheckpoint(resumeId)
    playComplete()
    if (!review) finishLesson(lesson.id)
    if (!review && !initialProgress.current.lessonsDone[lesson.id]) { store.awardXp(15); setXp(value => value + 15) }
    recordHistory({ course: 'jiayin', kind: 'node', lesson: lesson.unit.id, node: `lesson:${lesson.id}`, title: `${review ? 'Ulangi' : 'Pelajaran'} · ${lesson.item.questionId}` })
    setDone(true)
  }, [complete, lesson, review, resumeId])

  function credit() {
    if (credited.current.has(step.id)) return
    credited.current.add(step.id)
    store.practiceLog()
    if (!initialProgress.current.lessonsDone[lesson.id] && !review) { store.awardXp(3); setXp(value => value + 3) }
  }
  function advance() { credit(); playAdvance(); setIndex(current => Math.min(current + 1, steps.length - 1)) }
  function markAssistance() { note(aidKey, '1') }
  function queueRetry() {
    if (review || step.id.startsWith('retry:')) return
    retryIds.current.add(step.id)
    setSteps(current => appendJiayinRetry(current, step))
  }
  function saveProduction(assessment: ProductionAssessment, response: string, helped: boolean) {
    exercise(jiayinExerciseKey(step.id), { at: Date.now(), correct: assessment.accepted === true, assisted: helped, evidence: assessment.evidence, response })
    // Every shown reference is recorded, even if the learner closes before Continue.
    note(aidKey, '1')
    if (step.kind === 'answer') attempt(lesson.id, { at: Date.now(), rating: assessment.accepted === true ? 3 : 2, assisted: helped || assessment.evidence === 'practice', answer: response, seconds: 0 })
    recordHistory({ course: 'jiayin', kind: 'quiz', lesson: lesson.unit.id, node: step.id, correct: assessment.evidence === 'practice' ? undefined : assessment.accepted === true, title: step.kind === 'answer' ? 'Jawaban wawancara · pemeriksaan Mandarin' : 'Ketik kalimat · pemeriksaan Mandarin' })
  }
  function finishProduction(result: ProductionResult) {
    if (!result.correct || result.assisted || result.evidence === 'practice') queueRetry()
    note(aidKey, '')
    advance()
  }
  function wordAttempt(correct: boolean, helped: boolean) {
    exercise(jiayinExerciseKey(step.id), { at: Date.now(), correct, assisted: helped, evidence: 'exact' })
    note(aidKey, '1')
    if (!correct || helped) queueRetry()
  }
  const fullAnswer = step.kind === 'answer'
  const example = step.kind === 'sentence' ? jiayinSentence(lesson, step.chunk) : jiayinAnswerExample(lesson)
  const targets = words.filter(word => example.zh.includes(word.zh)).map(word => word.zh)
  const selfPrompt = jiayinLessonPrompt(lesson)

  return <div className="overlay session learning-session jiayin-overlay" role="dialog" aria-modal="true" aria-label={`Pelajaran: ${lesson.item.questionId}`}>
    <div className="overlay-head"><button className="icon-round tap44" aria-label="Tutup pelajaran Jiayin" onClick={onClose}><CloseIcon /></button><div className="step-bar"><i style={{ width: `${complete ? 100 : index / Math.max(1, steps.length - 1) * 100}%` }} /></div><span className="jiayin-step-count">{Math.min(index + 1, steps.length)}/{steps.length}</span></div>
    <div className="overlay-body jiayin-session jiayin-guided" ref={body}>
      <div className="jiayin-session-label">Bab {lesson.unit.id} · {lesson.unit.title} · PDF hlm. {lesson.item.page}</div>
      <div className="jiayin-phase-track" aria-label="Tahap pelajaran">{JIAYIN_LEARNING_STAGES.map(phase => <span key={phase} data-current={phase === step.phase}>{phase}</span>)}</div>
      {complete ? <div className="jiayin-teach jiayin-done"><span className="kicker-ink">{review ? 'Pengulangan' : 'Pelajaran'} selesai · +{xp} XP</span><h2>{open.length ? 'Sudah berlatih. Bagian ini perlu diulang.' : 'Jawabanmu sudah diperiksa.'}</h2>
        <p>{independent}/{assessedSteps.length} latihan terakhir benar tanpa bantuan. Menyelesaikan pelajaran berbeda dari konsisten menjawab pada hari lain.</p>
        {open.length > 0 && <div className="jiayin-context-block"><h3>Yang masih perlu dilatih</h3><ul>{open.slice(0, 6).map(candidate => <li key={candidate.id}>{candidate.kind === 'word' ? candidate.word.id : candidate.kind === 'sentence' ? `Kalimat ${candidate.chunk + 1}` : candidate.kind === 'answer' ? 'Jawaban lengkap' : 'Pemahaman isi'}</li>)}</ul>{open.length > 6 && <small>Dan {open.length - 6} latihan lainnya.</small>}</div>}
        <div className="jiayin-context-block"><h3>Jika pewawancara bertanya lebih jauh</h3><p>{lesson.item.followup}</p></div>
        <p className="jiayin-source">Pemeriksaan membahas kata, makna, dan susunan kalimat. Bukti pengalaman serta pelafalan tidak otomatis diverifikasi.</p>
        {done && <><button className="btn" onClick={() => { if (nextLesson) onNextLesson(nextLesson); else onClose() }}>{nextLesson ? `Lanjut: ${nextLesson.item.questionId}` : 'Kembali ke kurikulum'}</button><button className="jiayin-secondary" onClick={onClose}>Lihat peta pelajaran</button></>}
      </div> : step.kind === 'orient' ? <LessonOrientation lesson={lesson} onNext={advance} />
        : step.kind === 'teach' ? <WordTeaching word={step.word} remember={step.beat === 'remember'} lesson={lesson} onNext={advance} />
          : step.kind === 'read' ? <SentenceReading lesson={lesson} chunk={step.chunk} onNext={advance} />
            : step.kind === 'pattern' ? <div className="jiayin-teach"><h2>Pola untuk jawaban ini</h2><p lang="zh-CN">{lesson.unit.pattern.zh}</p><p className="jiayin-pinyin">{lesson.unit.pattern.pinyin}</p><p>{lesson.unit.pattern.explanation}</p><button className="btn" onClick={advance}>Sekarang ingat tanpa contoh</button></div>
              : step.kind === 'word' ? <><p className="jiayin-task-lead">Tulis kata Mandarin dari arti Indonesia. Jawaban tidak tampil sampai kamu memeriksa.</p><WordRecall key={step.id} word={asJiayinVocab(step.word)} n={words.findIndex(word => word.zh === step.word.zh) + 1} of={words.length} externallyAssisted={assisted} onAssistance={markAssistance} onAttempt={wordAttempt} onComplete={() => { note(aidKey, ''); advance() }} /></>
                : step.kind === 'sentence' || fullAnswer ? <div className="jiayin-teach"><span className="kicker-ink">{fullAnswer ? 'Giliranmu · jawab pewawancara' : `Ketik kalimat ${step.kind === 'sentence' ? step.chunk + 1 : ''} sendiri`}</span>
                  <h2 lang={fullAnswer ? selfPrompt.language : 'id'}>{fullAnswer ? selfPrompt.text : example.en}</h2>
                  <p>{fullAnswer ? 'Sampaikan jawaban Mandarin tanpa skrip. Setelah diperiksa, lihat apa yang perlu diperbaiki dan coba lagi.' : 'Ubah arti Indonesia ini menjadi Mandarin. Ketik atau bicara; susunan referensi tetap tersembunyi.'}</p>
                  {fullAnswer && <div className="jiayin-answer-criteria"><h3>Isi yang harus tersampaikan</h3>{lesson.item.criteria.map(criterion => <p key={criterion}>{criterion}</p>)}</div>}
                  {fullAnswer && lesson.item.needsEvidence && <PersonalEvidence lesson={lesson} onOpen={markAssistance} />}
                  <ResponsePractice key={step.id} example={example} targetWords={targets} glosses={glosses} context={`Pertanyaan: ${lesson.item.questionZh}\n${lesson.item.intent}\n${lesson.item.needsEvidence ? 'Referensi merupakan kerangka. Jangan menganggapnya bukti pengalaman yang sudah terjadi.' : ''}`} preferredMode={fullAnswer ? 'speaking' : 'writing'} externallyAssisted={assisted} onAssistance={markAssistance} taskLabel={fullAnswer ? `Jawab dalam Mandarin: ${lesson.item.questionId}` : `Tulis dalam Mandarin: ${example.en}`} continueLabel="Lanjut" onChecked={saveProduction} onComplete={finishProduction} />
                </div>
                  : step.kind === 'check' ? <LessonCheck key={step.id} quiz={step.quiz} checked={checked} onPick={correct => { exercise(jiayinExerciseKey(step.id), { at: Date.now(), correct, assisted, evidence: 'exact' }); note(aidKey, '1'); if (!correct) queueRetry(); setChecked(true) }} onNext={() => { note(aidKey, ''); advance() }} /> : null}
    </div>
  </div>
}

function LessonOrientation({ lesson, onNext }: { lesson: JiayinLesson; onNext: () => void }) {
  const counts = answerChunks(lesson.item.answerZh).length
  return <div className="jiayin-teach"><span className="kicker-ink">Satu pertanyaan · satu pelajaran lengkap</span><h2>{lesson.item.questionId}</h2><p>{lesson.item.intent}</p>
    <div className="jiayin-context-block"><h3>Yang akan kamu kerjakan</h3><ol><li>Kenali {lesson.words.length} kata yang muncul dalam jawaban ini.</li><li>Pahami {counts} kalimat, pinyin, dan makna Indonesianya.</li><li>Tulis kata-katanya dari ingatan, tanpa pilihan jawaban.</li><li>Tulis tiap kalimat, lalu jawab pertanyaan lengkap sendiri.</li><li>Periksa hasil, perbaiki, dan ulangi bagian yang perlu bantuan.</li></ol></div>
    <p>{lesson.item.coach}</p>{lesson.item.needsEvidence && <p className="jiayin-evidence">Siapkan pengalaman asli untuk jawaban ini. Contoh bahasa dalam PDF belum menggantikan bukti pribadimu.</p>}
    <button className="btn" onClick={onNext}>Mulai dari kata pertama</button>
  </div>
}
function WordTeaching({ word, remember, lesson, onNext }: { word: JiayinWord; remember: boolean; lesson: JiayinLesson; onNext: () => void }) {
  const index = answerChunks(lesson.item.answerZh).findIndex(chunk => chunk.includes(word.zh))
  const [show, setShow] = useState(false)
  return <div className="jiayin-teach"><span className="kicker-ink">{remember ? 'Cara mengingat dan penggunaan' : 'Kenali kata dari jawaban'}</span><h2 className="jiayin-word" lang="zh-CN">{word.zh}</h2><p className="jiayin-pinyin">{word.pinyin}</p><h3>{word.id}</h3>
    {remember ? <><p>{word.tip}</p><button className="jiayin-secondary" onClick={() => setShow(!show)}>{show ? 'Tutup contoh' : 'Lihat kata ini dalam jawaban'}</button>{show && index >= 0 && <div className="jiayin-answer-line"><p lang="zh-CN">{jiayinSentence(lesson, index).zh}</p><p className="jiayin-pinyin">{jiayinSentence(lesson, index).pinyin}</p><p className="jiayin-line-meaning">{jiayinSentence(lesson, index).en}</p></div>}</>
      : <><HearButton text={word.zh} label="Dengar dan tirukan" playingLabel="Sedang diputar" stopLabel="Hentikan" /><details className="jiayin-pattern"><summary>Lihat susunan goresan Hanzi</summary><StrokeWord text={word.zh} showAttribution={false} /></details></>}
    <button className="btn" onClick={onNext}>{remember ? 'Lanjut' : 'Pelajari cara mengingat'}</button>
  </div>
}
function SentenceReading({ lesson, chunk, onNext }: { lesson: JiayinLesson; chunk: number; onNext: () => void }) {
  const example = jiayinSentence(lesson, chunk)
  const [hidden, setHidden] = useState(false)
  return <div className="jiayin-teach"><span className="kicker-ink">Pahami kalimat {chunk + 1} dari {lesson.item.chunkId.length}</span><h2>{lesson.item.questionId}</h2><div className="jiayin-answer-line"><p lang="zh-CN">{hidden ? 'Ucapkan kalimatnya dari ingatan.' : example.zh}</p>{!hidden && <p className="jiayin-pinyin">{example.pinyin}</p>}<p className="jiayin-line-meaning">{example.en}</p>{!hidden && <HearButton text={example.zh} label="Dengar kalimat ini" playingLabel="Sedang diputar" stopLabel="Hentikan" />}</div>
    <button className="jiayin-secondary" onClick={() => setHidden(!hidden)}>{hidden ? 'Lihat lagi' : 'Tutup Mandarin, coba ucapkan'}</button><p className="jiayin-source">Ini latihan memahami. Pemeriksaan jawabanmu dilakukan di tahap Ingat dan Jawab sendiri.</p><button className="btn" onClick={onNext}>Lanjut</button>
  </div>
}
function PersonalEvidence({ lesson, onOpen }: { lesson: JiayinLesson; onOpen: () => void }) {
  const { progress, note } = useJiayinProgress()
  const [open, setOpen] = useState(false)
  const key = `answer:${lesson.id}`
  const notes = jiayinEvidenceNotes(lesson.id, progress, jiayinData.worksheets)
  return <div className="jiayin-evidence-note"><button className="jiayin-secondary" onClick={() => { setOpen(!open); if (!open) onOpen() }}>{notes ? 'Catatan pengalaman asli tersedia' : 'Bukti asli belum diisi'} · {open ? 'tutup' : 'buka'}</button>{open && <label>Situasi, tindakan pribadi, dan bukti hasil<textarea rows={4} value={notes} onChange={event => note(key, event.target.value)} /><small>Membuka catatan saat menjawab dihitung sebagai bantuan. Kebenaran pengalaman tidak dinilai otomatis oleh pemeriksa bahasa.</small></label>}</div>
}
function LessonCheck({ quiz, checked, onPick, onNext }: { quiz: JiayinQuiz; checked: boolean; onPick: (correct: boolean) => void; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  return <div className="jiayin-teach"><span className="kicker-ink">Cek pemahaman isi</span><h2>{quiz.prompt}</h2><div className="jiayin-options">{quiz.choices.map((choice, index) => <button key={choice} disabled={checked} data-correct={checked && index === quiz.answer} data-picked={picked === index} onClick={() => { setPicked(index); onPick(index === quiz.answer) }}>{choice}</button>)}</div>{checked && <div className="jiayin-feedback" role="status"><strong>{picked === quiz.answer ? 'Benar.' : 'Perhatikan perbedaannya.'}</strong><p>{quiz.explanation}</p></div>}<button className="btn" disabled={!checked} onClick={onNext}>Lanjut</button></div>
}
