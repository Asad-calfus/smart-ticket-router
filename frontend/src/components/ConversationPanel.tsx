import { useState } from "react"
import type { AssignedTeam, RoutingResult, TicketCategory, TicketPriority, TicketRead } from "../types"
import { AIRecommendationCard } from "./AIRecommendationCard"
import { PriorityBadge, StatusBadge } from "./Badge"
import { ContextComparisonPanel } from "./ContextComparisonPanel"
import { EmptyState, ErrorState, LoadingSkeleton } from "./StateViews"

interface ConversationPanelProps {
  ticket: TicketRead | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  routingResult: RoutingResult | null
  routingResultIsLive: boolean
  isRouting: boolean
  isSubmittingFeedback: boolean
  actionError: string | null
  onRouteTicket: () => void
  onAcceptRouting: () => void
  onEditRouting: (edits: { category: TicketCategory; priority: TicketPriority; assignedTeam: AssignedTeam }) => void
  onSendForHumanReview: () => void
  onResolveTicket: (resolution: string) => void
}

export function ConversationPanel({
  ticket,
  isLoading,
  error,
  onRetry,
  routingResult,
  routingResultIsLive,
  isRouting,
  isSubmittingFeedback,
  actionError,
  onRouteTicket,
  onAcceptRouting,
  onEditRouting,
  onSendForHumanReview,
  onResolveTicket,
}: ConversationPanelProps) {
  const [activeTab, setActiveTab] = useState<"public" | "internal">("public")
  const [resolutionText, setResolutionText] = useState("")

  if (isLoading) {
    return (
      <div className="flex h-full flex-col bg-white">
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6">
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <EmptyState title="Select a ticket" description="Choose a ticket from the queue to view its details." />
      </div>
    )
  }

  const isUnrouted = ticket.category === null

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Ticket #{ticket.id}</h2>
          <span data-testid="ticket-status-badge">
            <StatusBadge status={ticket.status} />
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {ticket.customer_name} &middot; {ticket.channel} &middot; {new Date(ticket.created_at).toLocaleString()}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          {ticket.assigned_team && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{ticket.assigned_team}</span>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 px-4 pt-3">
        <div className="flex gap-4 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("public")}
            className={`border-b-2 pb-2 font-medium ${
              activeTab === "public" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"
            }`}
          >
            Public Reply
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("internal")}
            className={`border-b-2 pb-2 font-medium ${
              activeTab === "internal" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"
            }`}
          >
            Internal Note
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.message}</p>
        </div>

        {activeTab === "public" && (
          <p className="text-xs text-slate-400">
            Public reply composer is not part of this demo's scope — routing decisions are the focus here.
          </p>
        )}
        {activeTab === "internal" && (
          <p className="text-xs text-slate-400">Internal notes are not persisted in this demo.</p>
        )}

        {actionError && <ErrorState message={actionError} />}

        {isUnrouted && !routingResult && (
          <button
            type="button"
            onClick={onRouteTicket}
            disabled={isRouting}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isRouting ? "Routing..." : "Route Ticket"}
          </button>
        )}

        {routingResult && (
          <AIRecommendationCard
            result={routingResult}
            isLiveEvidence={routingResultIsLive}
            onAccept={onAcceptRouting}
            onEdit={onEditRouting}
            onSendForHumanReview={onSendForHumanReview}
            isSubmitting={isSubmittingFeedback}
          />
        )}

        {routingResult && (
          <ContextComparisonPanel customerId={ticket.customer_id} message={ticket.message} ticketId={ticket.id} />
        )}

        {ticket.status !== "Resolved" && (
          <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="text-sm font-semibold text-slate-700">Resolve Ticket</h3>
            <textarea
              value={resolutionText}
              onChange={(event) => setResolutionText(event.target.value)}
              placeholder="Summarize how this was resolved..."
              rows={2}
              className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
            />
            <button
              type="button"
              disabled={!resolutionText.trim()}
              onClick={() => {
                onResolveTicket(resolutionText.trim())
                setResolutionText("")
              }}
              className="mt-2 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Resolve Ticket
            </button>
          </div>
        )}

        {ticket.status === "Resolved" && ticket.resolution && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Resolution</p>
            <p className="mt-1">{ticket.resolution}</p>
          </div>
        )}
      </div>
    </div>
  )
}
