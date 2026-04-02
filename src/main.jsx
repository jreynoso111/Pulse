import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const rootElement = document.getElementById('root')
const landingElement = document.getElementById('marketing-landing')

const isAppRoute = () => window.location.hash.startsWith('#/app')

let hasMountedApp = false

function mountApp() {
  if (hasMountedApp || !rootElement) return

  rootElement.hidden = false
  if (landingElement) landingElement.hidden = true

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <HashRouter>
          <App />
        </HashRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )

  hasMountedApp = true
}

function syncView() {
  if (isAppRoute()) {
    mountApp()
    if (rootElement) rootElement.hidden = false
    if (landingElement) landingElement.hidden = true
    return
  }

  if (rootElement) rootElement.hidden = true
  if (landingElement) landingElement.hidden = false
}

syncView()
window.addEventListener('hashchange', syncView)
