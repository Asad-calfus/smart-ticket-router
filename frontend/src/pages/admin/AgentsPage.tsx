import { useEffect, useState } from "react"
import { ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { api, ApiError } from "../../services/api"
import type { AgentUser, AssignedTeam } from "../../types"
import { ASSIGNED_TEAMS } from "../../types"

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"Support Agent" | "Admin">("Support Agent")
  const [inviteTeam, setInviteTeam] = useState<AssignedTeam>("General Support")
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)

  function load() {
    setIsLoading(true)
    setError(null)
    api
      .listAgents()
      .then(setAgents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load agents."))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault()
    setIsInviting(true)
    setInviteMessage(null)
    try {
      const response = await api.inviteAgent({ email: inviteEmail, role: inviteRole, team: inviteTeam })
      setInviteMessage(response.message)
      setInviteEmail("")
    } catch (err) {
      setInviteMessage(err instanceof ApiError ? err.message : "Could not send invitation.")
    } finally {
      setIsInviting(false)
    }
  }

  async function toggleActive(agent: AgentUser) {
    try {
      const updated = agent.is_active ? await api.deactivateAgent(agent.id) : await api.activateAgent(agent.id)
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this agent.")
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800">Agents & Admins</h2>

      <form onSubmit={handleInvite} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-xs font-medium text-slate-600">
          Email
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Role
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "Support Agent" | "Admin")}
            className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option>Support Agent</option>
            <option>Admin</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Team
          <select
            value={inviteTeam}
            onChange={(e) => setInviteTeam(e.target.value as AssignedTeam)}
            className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {ASSIGNED_TEAMS.map((team) => (
              <option key={team}>{team}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={isInviting}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isInviting ? "Inviting..." : "Invite"}
        </button>
        {inviteMessage && <p className="w-full text-xs text-slate-600">{inviteMessage}</p>}
      </form>

      <div className="mt-4">
        {isLoading && <LoadingSkeleton rows={4} />}
        {!isLoading && error && <ErrorState message={error} onRetry={load} />}
        {!isLoading && !error && (
          <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Role</th>
                <th className="p-2">Team</th>
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-t border-slate-100">
                  <td className="p-2">{agent.display_name ?? "—"}</td>
                  <td className="p-2">{agent.email}</td>
                  <td className="p-2">{agent.role}</td>
                  <td className="p-2">{agent.team ?? "—"}</td>
                  <td className="p-2">
                    <span className={agent.is_active ? "text-emerald-700" : "text-red-600"}>
                      {agent.is_active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActive(agent)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {agent.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
