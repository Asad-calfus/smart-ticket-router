import { NavLink, Outlet } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded px-3 py-1.5 text-sm font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
}

export function CustomerLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
        <h1 className="text-sm font-semibold text-slate-800">Support</h1>
        <nav className="flex items-center gap-1">
          <NavLink to="/my-tickets" className={navClass}>
            My Tickets
          </NavLink>
          <NavLink to="/new-ticket" className={navClass}>
            New Ticket
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            Profile
          </NavLink>
          <span className="mx-2 text-xs text-slate-400">{user?.email}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Log out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
