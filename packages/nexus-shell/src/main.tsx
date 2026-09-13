// NexusAI Shell 入口：默认暗色主题 + 挂载 React 根。

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/shell.css'

document.documentElement.dataset.theme = 'dark'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
