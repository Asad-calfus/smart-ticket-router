import { useState } from "react"
import type {
  AgentRosterItem,
  AssignedTeam,
  RoutingResult,
  TicketCategory,
  TicketMessage,
  TicketPriority,
  TicketRead,
} from "../types"
import { AIRecommendationCard } from "./AIRecommendationCard"
import { PriorityBadge, StatusBadge } from "./Badge"
import { ContextComparisonPanel } from "./ContextComparisonPanel"
import { EmptyState, ErrorState, LoadingSkeleton } from "./StateViews"

interface ConversationPanelProps {
  ticket: TicketRead | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  messages: TicketMessage[]
  agentRoster: AgentRosterItem[]
  onAssign: (agentUserId: number) => void
  onSendMessage: (body: string, messageType: "Agent Reply" | "Internal Note") => void
  routingResult: RoutingResult | null
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
  messages,
  agentRoster,
  onAssign,
  onSendMessage,
  routingResult,
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
  const [composerText, setComposerText] = useState("")
  const [resolutionText, setResolutionText] = useState("")
  const [assigneeId, setAssigneeId] = useState<number | "">("")

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
  const visibleMessages = messages.filter((m) =>
    activeTab === "public" ? m.message_type !== "Internal Note" : m.message_type === "Internal Note",
  )

  function handleSend() {
    if (!composerText.trim()) return
    onSendMessage(composerText.trim(), activeTab === "public" ? "Agent Reply" : "Internal Note")
    setComposerText("")
  }

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

        <div className="mt-3 flex items-center gap-2">
          <select
            aria-label="Assign to agent"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : "")}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">Assign to...</option>
            {agentRoster.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.display_name}
                {agent.team ? ` (${agent.team})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={assigneeId === ""}
            onClick={() => {
              if (assigneeId !== "") onAssign(assigneeId)
            }}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Assign
          </button>
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

        <div className="space-y-2">
          {visibleMessages.length === 0 && (
            <p className="text-xs text-slate-400">
              {activeTab === "public" ? "No replies yet." : "No internal notes yet."}
            </p>
          )}
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className={`rounded-md p-2.5 text-sm ${
                message.message_type === "Internal Note" ? "bg-amber-50 ring-1 ring-amber-200" : "bg-white ring-1 ring-slate-200"
              }`}
            >
              <p className="text-xs font-medium text-slate-500">
                {message.author_label} &middot; {new Date(message.created_at).toLocaleString()}
              </p>
              <p className="mt-1 text-slate-700">{message.body}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            rows={2}
            placeholder={activeTab === "public" ? "Reply to the customer..." : "Note visible only to agents..."}
            className="flex-1 rounded border border-slate-300 p-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!composerText.trim()}
            className="self-end rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>

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
