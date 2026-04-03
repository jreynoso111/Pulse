import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { PulseWorkspaceProvider } from './context/PulseWorkspaceContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PulseWorkspaceProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </PulseWorkspaceProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
