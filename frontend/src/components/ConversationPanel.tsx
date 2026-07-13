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
import { Button } from "./ui/Button"
import { Select, Textarea } from "./ui/Input"
import { SectionHeader, Tabs } from "./ui/Tabs"
import { InlineFeedback } from "./ui/Toast"

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
  actionSuccess: string | null
  onRouteTicket: () => void
  onAcceptRouting: () => void
  onEditRouting: (edits: { category: TicketCategory; priority: TicketPriority; assignedTeam: AssignedTeam }) => void
  onSendForHumanReview: () => void
  onResolveTicket: (resolution: string) => void
}

const REPLY_TABS = [
  { key: "public", label: "Public Reply" },
  { key: "internal", label: "Internal Note" },
]

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
  actionSuccess,
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
      <div className="flex h-full flex-col bg-surface">
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-6">
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
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
    <div className="flex h-full flex-col overflow-y-auto bg-surface">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Ticket #{ticket.id}</h2>
          <span data-testid="ticket-status-badge">
            <StatusBadge status={ticket.status} />
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {ticket.customer_name} &middot; {ticket.channel} &middot; {new Date(ticket.created_at).toLocaleString()}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          {ticket.assigned_team && (
            <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
              {ticket.assigned_team}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Select
            aria-label="Assign to agent"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : "")}
            className="h-8 w-auto text-xs"
          >
            <option value="">Assign to...</option>
            {agentRoster.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.display_name}
                {agent.team ? ` (${agent.team})` : ""}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="sm"
            disabled={assigneeId === ""}
            onClick={() => {
              if (assigneeId !== "") onAssign(assigneeId)
            }}
          >
            Assign
          </Button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <Tabs
          tabs={REPLY_TABS}
          active={activeTab}
          onChange={(key) => setActiveTab(key as "public" | "internal")}
        />
      </div>

      <div className="space-y-4 p-4">
        <div>
          <SectionHeader title="Conversation" />
          <div className="mt-2 rounded-md border border-border bg-surface-2 p-3">
            <p className="text-xs font-medium text-muted-foreground">Customer</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{ticket.message}</p>
          </div>

          <div className="mt-2 space-y-2">
            {visibleMessages.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {activeTab === "public" ? "No replies yet." : "No internal notes yet."}
              </p>
            )}
            {visibleMessages.map((message) => {
              const isInternal = message.message_type === "Internal Note"
              return (
                <div
                  key={message.id}
                  className={`rounded-md border p-2.5 text-sm ${
                    isInternal ? "border-warning-border bg-warning-bg" : "border-border bg-surface"
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {isInternal && (
                      <span className="rounded bg-warning-bg px-1.5 py-0.5 font-semibold text-warning ring-1 ring-inset ring-warning-border">
                        Internal
                      </span>
                    )}
                    {message.author_label} &middot; {new Date(message.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 text-foreground">{message.body}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-2 flex gap-2">
            <Textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              rows={2}
              placeholder={activeTab === "public" ? "Reply to the customer..." : "Note visible only to agents..."}
              className="flex-1"
            />
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!composerText.trim()} className="self-end">
              Send
            </Button>
          </div>
        </div>

        {actionError && <InlineFeedback tone="error" message={actionError} />}
        {actionSuccess && <InlineFeedback tone="success" message={actionSuccess} />}

        {isUnrouted && !routingResult && (
          <div>
            <SectionHeader title="Route Ticket" />
            <p className="mt-1 text-xs text-muted-foreground">
              Run the AI router to get a category, priority and team recommendation before this ticket can move
              forward.
            </p>
            <Button variant="primary" size="sm" onClick={onRouteTicket} disabled={isRouting} className="mt-2">
              {isRouting ? "Routing..." : "Route Ticket"}
            </Button>
          </div>
        )}

        {routingResult && (
          <div>
            <SectionHeader title="AI Recommendation" />
            <div className="mt-2">
              <AIRecommendationCard
                result={routingResult}
                onAccept={onAcceptRouting}
                onEdit={onEditRouting}
                onSendForHumanReview={onSendForHumanReview}
                isSubmitting={isSubmittingFeedback}
                ticketStatus={ticket.status}
              />
            </div>
          </div>
        )}

        {routingResult && <ContextComparisonPanel customerId={ticket.customer_id} message={ticket.message} ticketId={ticket.id} />}

        {ticket.status !== "Resolved" && (
          <div>
            <SectionHeader title="Resolve Ticket" />
            <Textarea
              value={resolutionText}
              onChange={(event) => setResolutionText(event.target.value)}
              placeholder="Summarize how this was resolved..."
              rows={2}
              className="mt-2"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!resolutionText.trim()}
              onClick={() => {
                onResolveTicket(resolutionText.trim())
                setResolutionText("")
              }}
              className="mt-2"
            >
              Resolve Ticket
            </Button>
          </div>
        )}

        {ticket.status === "Resolved" && ticket.resolution && (
          <div className="rounded-md border border-success-border bg-success-bg p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-success">Resolution</p>
            <p className="mt-1 text-sm text-success">{ticket.resolution}</p>
          </div>
        )}
      </div>
    </div>
  )
}
