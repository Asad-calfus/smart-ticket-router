import { useEffect, useMemo, useState } from "react"
import { UserPlus } from "lucide-react"
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { Button } from "../../components/ui/Button"
import { ConfirmDialog } from "../../components/ui/ConfirmDialog"
import { Input, Select, SearchField } from "../../components/ui/Input"
import { InlineFeedback } from "../../components/ui/Toast"
import { api, ApiError } from "../../services/api"
import type { AgentUser, AssignedTeam } from "../../types"
import { ASSIGNED_TEAMS } from "../../types"

type RoleFilter = "all" | "Support Agent" | "Admin"
type StatusFilter = "all" | "active" | "inactive"

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"Support Agent" | "Admin">("Support Agent")
  const [inviteTeam, setInviteTeam] = useState<AssignedTeam>("General Support")
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteSucceeded, setInviteSucceeded] = useState(false)
  const [isInviting, setIsInviting] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const [pendingDeactivateId, setPendingDeactivateId] = useState<number | null>(null)

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
      setInviteSucceeded(true)
      setInviteEmail("")
    } catch (err) {
      setInviteMessage(err instanceof ApiError ? err.message : "Could not send invitation.")
      setInviteSucceeded(false)
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

  const pendingAgent = agents.find((a) => a.id === pendingDeactivateId) ?? null

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return agents.filter((agent) => {
      if (roleFilter !== "all" && agent.role !== roleFilter) return false
      if (statusFilter === "active" && !agent.is_active) return false
      if (statusFilter === "inactive" && agent.is_active) return false
      if (query) {
        const haystack = `${agent.display_name ?? ""} ${agent.email}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [agents, searchQuery, roleFilter, statusFilter])

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Agents & Admins</h2>
      <p className="mt-1 text-sm text-muted-foreground">Invite teammates and manage who has access to the workspace.</p>

      <form
        onSubmit={handleInvite}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Email
          <Input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-56"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Role
          <Select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "Support Agent" | "Admin")}
            className="w-40"
          >
            <option>Support Agent</option>
            <option>Admin</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Team
          <Select value={inviteTeam} onChange={(e) => setInviteTeam(e.target.value as AssignedTeam)} className="w-48">
            {ASSIGNED_TEAMS.map((team) => (
              <option key={team}>{team}</option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="primary" disabled={isInviting} icon={<UserPlus size={15} />}>
          {isInviting ? "Inviting..." : "Invite"}
        </Button>
        {inviteMessage && (
          <div className="w-full">
            <InlineFeedback tone={inviteSucceeded ? "success" : "error"} message={inviteMessage} />
          </div>
        )}
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="w-56">
          <SearchField
            placeholder="Search by name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search agents"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="w-40"
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          <option value="Support Agent">Support Agent</option>
          <option value="Admin">Admin</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="w-40"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </Select>
      </div>

      <div className="mt-3">
        {isLoading && <LoadingSkeleton rows={4} />}
        {!isLoading && error && <ErrorState message={error} onRetry={load} />}
        {!isLoading && !error && agents.length === 0 && (
          <EmptyState title="No agents yet" description="Invite a teammate to get started." />
        )}
        {!isLoading && !error && agents.length > 0 && filteredAgents.length === 0 && (
          <EmptyState title="No agents match your filters" description="Try a different search term or filter." />
        )}
        {!isLoading && !error && filteredAgents.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="border-t border-border">
                    <td className="p-3 text-foreground">{agent.display_name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{agent.email}</td>
                    <td className="p-3 text-foreground">{agent.role}</td>
                    <td className="p-3 text-muted-foreground">{agent.team ?? "—"}</td>
                    <td className="p-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          agent.is_active ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
                        }`}
                      >
                        {agent.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => (agent.is_active ? setPendingDeactivateId(agent.id) : toggleActive(agent))}
                      >
                        {agent.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeactivateId !== null}
        title="Deactivate agent?"
        description={
          pendingAgent
            ? `${pendingAgent.display_name ?? pendingAgent.email} will lose access to the workspace immediately. You can reactivate this account at any time.`
            : "This agent will lose access to the workspace immediately."
        }
        destructive
        confirmLabel="Deactivate"
        onConfirm={() => {
          if (pendingAgent) toggleActive(pendingAgent)
          setPendingDeactivateId(null)
        }}
        onCancel={() => setPendingDeactivateId(null)}
      />
    </div>
  )
}
