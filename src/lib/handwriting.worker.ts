import { assessHandwriting, loadHandwritingModel, recognizeHandwriting, type HandwritingModel, type InkDrawing } from './handwriting'
import { diagnoseWord } from './handwriting-review'

let model: HandwritingModel | null = null
self.onmessage = async (event: MessageEvent<{ type: 'init' | 'recognize' | 'assess' | 'assess-word'; url?: string; id?: number; drawing?: InkDrawing; drawings?: InkDrawing[]; expectedCharacter?: string; expectedWord?: string }>) => {
  try {
    if (event.data.type === 'init') {
      model = await loadHandwritingModel(event.data.url ?? '')
      self.postMessage({ type: 'ready', count: model.templates.length })
    } else if (model && event.data.type === 'assess-word') {
      self.postMessage({ type: 'word-assessment', id: event.data.id, assessment: diagnoseWord(event.data.drawings ?? [], model, event.data.expectedWord ?? '') })
    } else if (model && event.data.type === 'assess') {
      self.postMessage({ type: 'assessment', id: event.data.id, assessment: assessHandwriting(event.data.drawing ?? [], model, event.data.expectedCharacter ?? '') })
    } else if (model) {
      self.postMessage({ type: 'candidates', id: event.data.id, candidates: recognizeHandwriting(event.data.drawing ?? [], model) })
    }
  } catch {
    self.postMessage({ type: 'error', message: 'The handwriting dictionary could not load. Retry, or type your answer.' })
  }
}
