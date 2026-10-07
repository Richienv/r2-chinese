import { t } from './i18n.ts'

/** Browser speech recognition transcribes Mandarin; it does not grade pronunciation. */
export type RecognitionStatus = 'idle' | 'starting' | 'listening' | 'stopping' | 'error' | 'unsupported'

export interface RecognitionSnapshot {
  status: RecognitionStatus
  interim: string
  error: string
}

interface Result {
  isFinal: boolean
  length: number
  [index: number]: { transcript: string }
}

interface RecognitionEvent {
  resultIndex: number
  results: { length: number; [index: number]: Result }
}

interface BrowserRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => BrowserRecognition

function constructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined' || !window.isSecureContext) return undefined
  const browser = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export function canRecognizeMandarin(): boolean {
  return !!constructor()
}

export function recognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return t('Microphone access was blocked. Allow it in browser settings, or type your response.')
    case 'audio-capture':
      return t('No microphone is available. Connect a microphone, or type your response.')
    case 'network':
      return t('The browser could not reach its speech service. Retry, or type your response.')
    case 'no-speech':
      return t('No speech was detected. Tap the microphone and try again.')
    case 'language-not-supported':
      return t('This browser cannot recognize Mandarin. Type your response instead.')
    default:
      return t('Speech input stopped. Retry the microphone, or type your response.')
  }
}

/** Constructing this controller never requests a microphone. Only start() does. */
export function createMandarinRecognition(callbacks: {
  onState: (snapshot: RecognitionSnapshot) => void
  onFinal: (transcript: string) => void
}) {
  let recognition: BrowserRecognition | null = null
  let disposed = false
  let status: RecognitionStatus = 'idle'
  let error = ''
  let interim = ''
  let finals = new Map<number, string>()

  function publish(next: RecognitionStatus) {
    status = next
    if (!disposed) callbacks.onState({ status, interim, error })
  }

  function disconnect() {
    if (!recognition) return
    recognition.onstart = null
    recognition.onend = null
    recognition.onresult = null
    recognition.onerror = null
    try { recognition.abort() } catch { /* Already-ended recognition needs no cleanup. */ }
    recognition = null
  }

  return {
    start() {
      if (disposed || status === 'starting' || status === 'listening' || status === 'stopping') return
      const Ctor = constructor()
      if (!Ctor) {
        error = t('Speech input is unavailable in this browser. Type below, or use a browser with Mandarin speech recognition on HTTPS.')
        publish('unsupported')
        return
      }
      disconnect()
      error = ''
      interim = ''
      finals = new Map()
      recognition = new Ctor()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.onstart = () => publish('listening')
      recognition.onresult = (event) => {
        const pending: string[] = []
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0]?.transcript.trim() ?? ''
          if (result.isFinal) finals.set(i, transcript)
          else pending.push(transcript)
        }
        interim = pending.join('')
        publish(status)
        if (finals.size > 0) callbacks.onFinal([...finals.values()].join(''))
      }
      recognition.onerror = (event) => {
        interim = ''
        if (event.error === 'aborted') return
        error = recognitionError(event.error)
        publish('error')
      }
      recognition.onend = () => {
        interim = ''
        if (status !== 'error') publish('idle')
      }
      publish('starting')
      try {
        recognition.start()
      } catch {
        error = recognitionError('start-failed')
        publish('error')
      }
    },
    stop() {
      if (status !== 'listening' && status !== 'starting') return
      publish('stopping')
      recognition?.stop()
    },
    cancel() {
      disconnect()
      interim = ''
      error = ''
      publish('idle')
    },
    dispose() {
      disposed = true
      disconnect()
    },
  }
}
