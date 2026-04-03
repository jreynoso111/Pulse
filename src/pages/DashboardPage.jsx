import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { usePulseWorkspace } from '../context/PulseWorkspaceContext'

function DashboardPage() {
  const navigate = useNavigate()
  const { dashboardData, boards } = usePulseWorkspace()

  if (
    !dashboardData.weeklyThroughput.length ||
    !dashboardData.trendData.length ||
    !dashboardData.pieData.length
  ) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-soft">
        <h2 className="text-lg font-semibold text-slate-800">No dashboard data</h2>
        <p className="mt-1 text-sm text-slate-500">Create boards and items to populate your workspace analytics.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Executive view across {boards.length} boards with portfolio health, throughput, and workload balance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardData.kpis.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(`/app/dashboard/${item.key}`)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-slate-300"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Open details</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft xl:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Weekly Completed Items</h2>
            <p className="text-xs text-slate-500">Progress completed during the last seven days</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.weeklyThroughput}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Bar dataKey="completed" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Status Split</h2>
            <p className="text-xs text-slate-500">Current distribution of work states across all boards</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dashboardData.pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label>
                  {dashboardData.pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-800">Workload Trend</h2>
          <p className="text-xs text-slate-500">Six-week view of active work versus completed work</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dashboardData.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="active" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completed" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  )
}

export default DashboardPage
