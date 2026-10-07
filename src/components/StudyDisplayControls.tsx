import { t } from '../lib/i18n'
import { useStore } from '../store/store'
import '../styles/study-tools.css'

/** Translation scaffolding belongs beside the lesson, where it can be removed. */
export function StudyDisplayControls() {
  const { prefs, setPref } = useStore()
  return (
    <div className="study-display" role="group" aria-label={t('Reading display')}>
      <span className="study-display-label">{t('Hanzi')}</span>
      <button type="button" aria-pressed={prefs.showPinyin} onClick={() => setPref('showPinyin', !prefs.showPinyin)}>{t('Pinyin')} <span aria-hidden="true">{prefs.showPinyin ? t('On') : t('Off')}</span></button>
      <button type="button" aria-pressed={prefs.showEnglish} onClick={() => setPref('showEnglish', !prefs.showEnglish)}>{t('English')} <span aria-hidden="true">{prefs.showEnglish ? t('On') : t('Off')}</span></button>
    </div>
  )
}
