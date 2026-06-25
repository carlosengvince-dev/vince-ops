import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/disciplinas.css'
import App from './App.tsx'
import { reorderTarefas } from './lib/tarefaManagement'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  ;(window as Window & { __testReorder?: () => void }).__testReorder = () => {
    const mock = [
      { id: '1', nome: 'A', ordem: 0 },
      { id: '2', nome: 'B', ordem: 1 },
      { id: '3', nome: 'C', ordem: 2 },
    ]
    const result = reorderTarefas(mock, 0, 2)
    console.assert(result[0].nome === 'B', 'Erro: B deve ser primeiro')
    console.assert(result[2].nome === 'A', 'Erro: A deve ser último')
  }
}
