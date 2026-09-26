import { useEffect, useState } from 'react'
import { getSpeechSnapshot, prefetch, speak, speakLines, stopSpeech, subscribeSpeech, unlockSpeech, type SpeakOpts } from '../lib/speech'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'

const HANZI = /[\u3400-\u9FFF]/

/** True when the string has at least one CJK ideograph (not pinyin-only / English). */
export function hasHanzi(text: string): boolean {
  return HANZI.test(text)
}

/** Strip to spoken Chinese runs; empty when there is nothing to say. */
export function chineseOnly(text: string): string {
  const parts = text.match(/[\u3400-\u9FFF]+(?:[\u3400-\u9FFF\s、，。！？：；…·—\-_/／]+)*/g)
  return (parts?.join(' ').replace(/\s+/g, ' ').trim() ?? '')
}

export function rateForChinese(text: string): number {
  const han = (text.match(/[\u3400-\u9FFF]/g) ?? []).length
  return han <= 4 ? WORD_RATE : LINE_RATE
}

export function useSpeechActive(key: string) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const sync = () => {
      const snap = getSpeechSnapshot()
      setOn(snap.status !== 'idle' && (snap.key === key || snap.group === key))
    }
    sync()
    const unsubscribe = subscribeSpeech(sync)
    return () => {
      unsubscribe()
    }
  }, [key])
  return on
}

/** Prefetch + autoplay one Chinese phrase when `text` becomes the current beat. */
export function useAutoSpeak(text: string, voice: string = VOICE.xiaoxiao, rate?: number) {
  const trimmed = text.trim()
  const resolvedRate = rate ?? (trimmed ? rateForChinese(trimmed) : WORD_RATE)
  useEffect(() => {
    if (!trimmed || !hasHanzi(trimmed)) return
    const key = `${voice}|${resolvedRate}|${trimmed}`
    prefetch(trimmed, { voice, rate: resolvedRate })
    const timer = window.setTimeout(() => {
      void speak(trimmed, { voice, rate: resolvedRate, key })
    }, 280)
    return () => {
      window.clearTimeout(timer)
      stopSpeech()
    }
  }, [trimmed, voice, resolvedRate])
}

/** Prefetch + autoplay several short Chinese items (e.g. quiz choices) in order. */
export function useAutoSpeakLines(lines: string[], voice: string = VOICE.xiaoxiao, rate: number = WORD_RATE) {
  const audible = lines.map((t) => t.trim()).filter((t) => t && hasHanzi(t))
  const joined = audible.join('\u0001')
  useEffect(() => {
    if (audible.length === 0) return
    const group = `lines|${joined}`
    for (const text of audible) prefetch(text, { voice, rate })
    const timer = window.setTimeout(() => {
      void speakLines(
        audible.map((text) => ({ text, voice, rate })),
        { group, key: group },
      )
    }, 280)
    return () => {
      window.clearTimeout(timer)
      stopSpeech()
    }
    // Replay when the spoken set changes, not when the array identity does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, voice, rate])
}

export function HearButton({
  text,
  voice,
  rate,
  label = 'Hear it',
  tone = 'ink',
  className,
}: {
  text: string
  voice?: string
  rate?: number
  label?: string
  tone?: 'ink' | 'on-red'
  className?: string
}) {
  const trimmed = text.trim()
  const speakable = trimmed && hasHanzi(trimmed) ? trimmed : ''
  const v = voice ?? VOICE.xiaoxiao
  const r = rate ?? (speakable ? rateForChinese(speakable) : WORD_RATE)
  const key = speakable ? `${v}|${r}|${speakable}` : ''
  const playing = useSpeechActive(key)
  const opts: SpeakOpts = { voice: v, rate: r, key }

  if (!speakable) return null

  return (
    <button
      type="button"
      className={`hear hear-${tone}${className ? ` ${className}` : ''}`}
      data-on={playing}
      aria-label={playing ? `Stop ${label}` : label}
      aria-pressed={playing}
      onPointerDown={() => unlockSpeech()}
      onClick={(e) => {
        e.stopPropagation()
        if (playing) stopSpeech()
        else void speak(speakable, opts)
      }}
    >
      {playing ? <PauseMark /> : <PlayMark />}
      <span>{playing ? 'Playing' : label}</span>
    </button>
  )
}

/**
 * Autoplay + Hear for one on-screen Chinese phrase.
 * Pass autoplay={false} when another mount (TeachBeats / DialogueAudio / GlossSheet) already speaks.
 */
export function ChineseHear({
  text,
  autoplay = true,
  label = 'Hear it',
  tone = 'ink',
  voice = VOICE.xiaoxiao,
  rate,
  className,
}: {
  text: string
  autoplay?: boolean
  label?: string
  tone?: 'ink' | 'on-red'
  voice?: string
  rate?: number
  className?: string
}) {
  const trimmed = text.trim()
  const speakable = trimmed && hasHanzi(trimmed) ? trimmed : ''
  const r = rate ?? (speakable ? rateForChinese(speakable) : WORD_RATE)
  useAutoSpeak(autoplay ? speakable : '', voice, r)
  if (!speakable) return null
  return <HearButton text={speakable} voice={voice} rate={r} label={label} tone={tone} className={className} />
}

function PlayMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

function PauseMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4.2v14H6zM13.8 5H18v14h-4.2z" />
    </svg>
  )
}
