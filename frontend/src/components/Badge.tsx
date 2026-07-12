import type { TicketPriority, TicketStatus } from "../types"

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  High: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  Medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  Low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
}

export function PriorityBadge({ priority }: { priority: TicketPriority | null }) {
  if (!priority) {
    return <span className="rounded px-2 py-0.5 text-xs font-medium text-slate-400">—</span>
  }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}>{priority}</span>
  )
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  Open: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  Routed: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  "In Progress": "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  "Needs Human Review": "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  Resolved: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  Reopened: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
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
    confidence >= 0.75 ? "text-emerald-700 bg-emerald-50" : confidence >= 0.5 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{percentage}% confidence</span>
}
