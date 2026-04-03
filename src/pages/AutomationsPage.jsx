import { usePulseWorkspace } from '../context/PulseWorkspaceContext'
import { Navigate } from 'react-router-dom'

function formatDateTime(value) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString()
}

function AutomationsPage() {
  const { automations, currentUser, toggleAutomation } = usePulseWorkspace()

  if (currentUser?.role !== 'admin') {
    return <Navigate to="/app/dashboard" replace />
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Automations</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Configure recurring summaries, notifications, and workflow reactions for the office workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {automations.map((automation) => (
          <article key={automation.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{automation.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{automation.description}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  toggleAutomation(automation.id).catch((error) => {
                    console.error('Failed to update automation.', error)
                  })
                }
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  automation.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {automation.enabled ? 'Enabled' : 'Paused'}
              </button>
            </div>

            <dl className="mt-4 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between gap-3">
                <dt>Trigger</dt>
                <dd className="font-medium text-slate-800">{automation.triggerType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Action</dt>
                <dd className="font-medium text-slate-800">{automation.actionType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Last run</dt>
                <dd className="text-right text-slate-800">{formatDateTime(automation.lastRunAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Next run</dt>
                <dd className="text-right text-slate-800">{formatDateTime(automation.nextRunAt)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}

export default AutomationsPage
