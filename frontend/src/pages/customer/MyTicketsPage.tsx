import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { PriorityBadge, StatusBadge } from "../../components/Badge"
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { api, ApiError } from "../../services/api"
import type { MyTicket } from "../../types"

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">My Tickets</h2>
        <Link
          to="/new-ticket"
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          + New Ticket
        </Link>
      </div>

      <div className="mt-4">
        {isLoading && <LoadingSkeleton rows={4} />}
        {!isLoading && error && <ErrorState message={error} onRetry={load} />}
        {!isLoading && !error && tickets.length === 0 && (
          <EmptyState title="No tickets yet" description="Submit a new ticket to get started." />
        )}
        {!isLoading && !error && tickets.length > 0 && (
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={`/tickets/${ticket.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">#{ticket.id}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-700">{ticket.message}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority} />
                    {ticket.category && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {ticket.category}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
