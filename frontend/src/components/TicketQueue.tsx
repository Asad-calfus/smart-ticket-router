import type { TicketListItem, TicketQueueFilter } from "../types"
import { ConfidenceBadge, PriorityBadge } from "./Badge"
import { EmptyState, ErrorState, LoadingSkeleton } from "./StateViews"

const FILTERS: { value: TicketQueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "high_priority", label: "High Priority" },
  { value: "needs_human_review", label: "Needs Human Review" },
  { value: "active_incident", label: "Active Incident" },
]

function formatWaitingTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

interface TicketQueueProps {
  tickets: TicketListItem[]
  filter: TicketQueueFilter
  onFilterChange: (filter: TicketQueueFilter) => void
  selectedTicketId: number | null
  onSelectTicket: (ticketId: number) => void
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export function TicketQueue({
  tickets,
  filter,
  onFilterChange,
  selectedTicketId,
  onSelectTicket,
  isLoading,
  error,
  onRetry,
}: TicketQueueProps) {
  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Ticket Queue</h2>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === item.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <LoadingSkeleton rows={6} />}
        {!isLoading && error && <ErrorState message={error} onRetry={onRetry} />}
        {!isLoading && !error && tickets.length === 0 && (
          <EmptyState title="No tickets match this filter" description="Try a different filter above." />
        )}
        {!isLoading &&
          !error &&
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => onSelectTicket(ticket.id)}
              className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                selectedTicketId === ticket.id ? "bg-blue-50 hover:bg-blue-50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">#{ticket.id}</span>
                <span className="text-xs text-slate-400">{formatWaitingTime(ticket.waiting_minutes)} waiting</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{ticket.message_preview}</p>
              <p className="truncate text-xs text-slate-500">{ticket.customer_name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <PriorityBadge priority={ticket.priority} />
                {ticket.assigned_team && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {ticket.assigned_team}
                  </span>
                )}
                {ticket.needs_human_review && (
                  <span className="rounded bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
                    Needs Review
                  </span>
                )}
                <ConfidenceBadge confidence={ticket.confidence} />
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}
