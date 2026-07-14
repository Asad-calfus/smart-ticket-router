import { useState } from "react"
import { Menu, X } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { ThemeSwitcher } from "./ThemeSwitcher"

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
    isActive ? "bg-accent-subtle text-accent" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
  }`
}

export function AgentLayout() {
  const { user, logout } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4">
        <div className="flex h-12 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 md:hidden"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="text-sm font-semibold text-foreground">Smart Support Ticket Router</h1>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/workspace" className={navClass}>
              Workspace
            </NavLink>
            <NavLink to="/analytics" className={navClass}>
              Analytics
            </NavLink>
            <NavLink to="/settings/llm" className={navClass}>
              LLM Settings
            </NavLink>
            {user?.role === "Admin" && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user?.agent_display_name ?? user?.email}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="flex flex-col gap-1 border-t border-border py-2 md:hidden">
            <NavLink to="/workspace" className={navClass} onClick={() => setMobileNavOpen(false)}>
              Workspace
            </NavLink>
            <NavLink to="/analytics" className={navClass} onClick={() => setMobileNavOpen(false)}>
              Analytics
            </NavLink>
            <NavLink to="/settings/llm" className={navClass} onClick={() => setMobileNavOpen(false)}>
              LLM Settings
            </NavLink>
            {user?.role === "Admin" && (
              <NavLink to="/admin" className={navClass} onClick={() => setMobileNavOpen(false)}>
                Admin
              </NavLink>
            )}
          </nav>
        )}
      </header>
      <Outlet />
    </div>
  )
}
