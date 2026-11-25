import { useState } from 'react'
import { HanziDrawing, type DrawingResult } from './HanziDrawing'
import { useHandwritingWordAssessment } from './HandwritingPad'
import { handwritingRecallEvidence, handwritingRetryMessage } from '../lib/handwriting-recall'
import { enrichVocab } from '../lib/content'
import { cleanGloss } from '../lib/recallContext'
import { recallTask } from '../lib/drawing-flow'
import { t } from '../lib/i18n'
import type { Vocab } from '../lib/types'

export function WritingRecall({
  word: rawWord,
  onAttempt,
  onType,
}: {
  word: Vocab
  onAttempt: (correct: boolean, assisted: boolean) => void
  onType: () => void
}) {
  const word = enrichVocab(rawWord)
  const cleaned = cleanGloss(word.en, word)
  const safeWord = { ...word, en: cleaned.other ? `${cleaned.core}; ${cleaned.other}` : cleaned.core || word.en }
  const assessment = useHandwritingWordAssessment(true)
  const [assisted, setAssisted] = useState(false),
    [message, setMessage] = useState('')
  function checked({ outcome, diagnosis }: DrawingResult) {
    const result = handwritingRecallEvidence(outcome)
    if (result === undefined) {
      setMessage(handwritingRetryMessage(diagnosis.assessment))
      return
    }
    onAttempt(result, assisted)
  }
  return (
    <div className="focus-writing">
      <HanziDrawing
        word={word.zh}
        task={recallTask('Draw', 'meaning', safeWord, Array.from(word.zh).length)}
        handwriting={assessment}
        solved={false}
        onChecked={checked}
        onAssist={() => setAssisted(true)}
        onTypeInstead={onType}
      />
      <p role="status">{message}</p>
      <button className="focus-link" onClick={onType}>
        {t('Switch to typed recall')}
      </button>
    </div>
  )
}
