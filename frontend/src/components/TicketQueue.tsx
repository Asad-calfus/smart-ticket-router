import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import type { TicketListItem, TicketQueueFilter } from "../types"
import { ConfidenceBadge, PriorityBadge } from "./Badge"
import { SearchField } from "./ui/Input"
import { EmptyState, ErrorState, LoadingSkeleton } from "./StateViews"

const FILTERS: { value: TicketQueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new_tickets", label: "New / Action Needed" },
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
  const [searchQuery, setSearchQuery] = useState("")
  const visibleTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return tickets
    return tickets.filter((ticket) =>
      [
        String(ticket.id),
        ticket.customer_name,
        ticket.message_preview,
        ticket.category ?? "",
        ticket.priority ?? "",
        ticket.assigned_team ?? "",
        ticket.status,
      ].some((value) => value.toLowerCase().includes(query)),
    )
  }, [searchQuery, tickets])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="border-b border-border p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Ticket Queue</h2>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Live &middot; refreshes every 5s
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRetry()}
            aria-label="Refresh"
            title="Refresh"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <SearchField
          aria-label="Search tickets"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search ID, customer, message..."
          className="mb-2"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                filter === item.value
                  ? "bg-accent-subtle text-accent"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
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
        {!isLoading && !error && visibleTickets.length === 0 && (
          <EmptyState
            title={searchQuery ? "No tickets match your search" : "No tickets match this filter"}
            description={searchQuery ? "Try another customer, ticket ID or keyword." : "Try a different filter above."}
          />
        )}
        {!isLoading &&
          !error &&
          visibleTickets.map((ticket) => {
            const isSelected = selectedTicketId === ticket.id
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onSelectTicket(ticket.id)}
                className={`block w-full border-b border-b-border border-l-2 px-3 py-2.5 text-left transition-colors duration-150 ${
                  isSelected
                    ? "border-l-selected-border bg-selected-bg hover:bg-selected-bg"
                    : "border-l-transparent hover:bg-surface-2"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">#{ticket.id}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {ticket.waiting_minutes < 5 && (
                      <span className="rounded bg-accent-subtle px-1.5 py-0.5 font-semibold text-accent">NEW</span>
                    )}
                    {formatWaitingTime(ticket.waiting_minutes)} waiting
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">{ticket.message_preview}</p>
                <p className="truncate text-xs text-muted-foreground">{ticket.customer_name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={ticket.priority} />
                  {ticket.assigned_team && (
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                      {ticket.assigned_team}
                    </span>
                  )}
                  {ticket.needs_human_review && (
                    <span className="rounded bg-review-bg px-2 py-0.5 text-xs font-medium text-review ring-1 ring-inset ring-review-border">
                      Needs Review
                    </span>
                  )}
                  <ConfidenceBadge confidence={ticket.confidence} />
                </div>
              </button>
            )
          })}
      </div>
    </div>
  )
}
