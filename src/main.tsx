import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initBookAudio } from './lib/bookAudio'
import { registerServiceWorker } from './lib/pwa'
import './styles.css'
import './styles/learning-lab.css'

initBookAudio()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import './styles/overhaul.css'
import './styles/design-system.css'
