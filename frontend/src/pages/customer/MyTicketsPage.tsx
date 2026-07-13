import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { PriorityBadge, StatusBadge } from "../../components/Badge"
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { SearchField, Select } from "../../components/ui/Input"
import { api, ApiError } from "../../services/api"
import type { MyTicket, TicketStatus } from "../../types"

const STATUS_OPTIONS: TicketStatus[] = ["Open", "Routed", "In Progress", "Needs Human Review", "Resolved", "Reopened"]

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all")

  function load() {
    setIsLoading(true)
    setError(null)
    api
      .listMyTickets()
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your tickets."))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        String(ticket.id).includes(normalizedQuery) ||
        ticket.message.toLowerCase().includes(normalizedQuery)
      return matchesStatus && matchesQuery
    })
  }, [tickets, query, statusFilter])

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">My Tickets</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"} total
          </p>
        </div>
        <Link
          to="/new-ticket"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-hover"
        >
          <Plus size={16} />
          New Ticket
        </Link>
      </div>

      {!isLoading && !error && tickets.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="sm:w-64">
            <SearchField
              placeholder="Search by ticket id or text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tickets"
            />
          </div>
          <div className="sm:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      <div className="mt-4">
        {isLoading && <LoadingSkeleton rows={4} />}
        {!isLoading && error && <ErrorState message={error} onRetry={load} />}
        {!isLoading && !error && tickets.length === 0 && (
          <EmptyState title="No tickets yet" description="Submit a new ticket to get started." />
        )}
        {!isLoading && !error && tickets.length > 0 && filteredTickets.length === 0 && (
          <EmptyState title="No matching tickets" description="Try a different search term or status filter." />
        )}
        {!isLoading && !error && filteredTickets.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {filteredTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={`/tickets/${ticket.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">#{ticket.id}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{ticket.message}</span>
                  {ticket.category && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{ticket.category}</span>
                  )}
                  <span className="shrink-0">
                    <PriorityBadge priority={ticket.priority} />
                  </span>
                  <span className="shrink-0">
                    <StatusBadge status={ticket.status} />
                  </span>
                  <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:inline">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
