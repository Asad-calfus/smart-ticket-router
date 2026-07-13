import type { TicketPriority, TicketStatus } from "../types"

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  High: "bg-danger-bg text-danger ring-1 ring-inset ring-danger-border",
  Medium: "bg-warning-bg text-warning ring-1 ring-inset ring-warning-border",
  Low: "bg-surface-2 text-muted-foreground ring-1 ring-inset ring-border",
}

export function PriorityBadge({ priority }: { priority: TicketPriority | null }) {
  if (!priority) {
    return <span className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground">—</span>
  }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}>{priority}</span>
  )
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  Open: "bg-surface-2 text-muted-foreground ring-1 ring-inset ring-border",
  Routed: "bg-accent-subtle text-accent ring-1 ring-inset ring-accent-subtle",
  "In Progress": "bg-accent text-accent-foreground",
  "Needs Human Review": "bg-review-bg text-review ring-1 ring-inset ring-review-border",
  Resolved: "bg-success-bg text-success ring-1 ring-inset ring-success-border",
  Reopened: "bg-warning-bg text-warning ring-1 ring-inset ring-warning-border",
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{status}</span>
}

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) {
    return null
  }
  const percentage = Math.round(confidence * 100)
  const tone =
    confidence >= 0.75
      ? "text-success bg-success-bg"
      : confidence >= 0.5
        ? "text-warning bg-warning-bg"
        : "text-danger bg-danger-bg"
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{percentage}% confidence</span>
}
