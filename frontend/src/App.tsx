import { useState } from "react"
import { AnalyticsPage } from "./pages/AnalyticsPage"
import { WorkspacePage } from "./pages/WorkspacePage"

type View = "workspace" | "analytics"

function App() {
  const [view, setView] = useState<View>("workspace")

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
        <h1 className="text-sm font-semibold text-slate-800">Smart Support Ticket Router</h1>
        <nav className="flex gap-1">
          <button
            type="button"
            onClick={() => setView("workspace")}
            className={`rounded px-3 py-1 text-xs font-medium ${
              view === "workspace" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Workspace
          </button>
          <button
            type="button"
            onClick={() => setView("analytics")}
            className={`rounded px-3 py-1 text-xs font-medium ${
              view === "analytics" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Analytics
          </button>
        </nav>
      </header>

      {view === "workspace" ? <WorkspacePage /> : <AnalyticsPage />}
    </div>
  )
}

export default App
