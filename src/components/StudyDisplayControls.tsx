import { useStore } from '../store/store'
import '../styles/study-tools.css'

/** Translation scaffolding belongs beside the lesson, where it can be removed. */
export function StudyDisplayControls() {
  const { prefs, setPref } = useStore()
  return (
    <div className="study-display" role="group" aria-label="Reading display">
      <span className="study-display-label">Hanzi</span>
      <button type="button" aria-pressed={prefs.showPinyin} onClick={() => setPref('showPinyin', !prefs.showPinyin)}>Pinyin <span aria-hidden="true">{prefs.showPinyin ? 'On' : 'Off'}</span></button>
      <button type="button" aria-pressed={prefs.showEnglish} onClick={() => setPref('showEnglish', !prefs.showEnglish)}>English <span aria-hidden="true">{prefs.showEnglish ? 'On' : 'Off'}</span></button>
    </div>
  )
}
