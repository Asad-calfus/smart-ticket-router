import { useState } from "react"
import type { AssignedTeam, RoutingResult, TicketCategory, TicketPriority, TicketStatus } from "../types"
import { ASSIGNED_TEAMS, TICKET_CATEGORIES, TICKET_PRIORITIES } from "../types"
import { ConfidenceBadge, PriorityBadge } from "./Badge"
import { Button } from "./ui/Button"
import { Select } from "./ui/Input"
import { InlineFeedback } from "./ui/Toast"

interface AIRecommendationCardProps {
  result: RoutingResult
  onAccept: () => void
  onEdit: (edits: { category: TicketCategory; priority: TicketPriority; assignedTeam: AssignedTeam }) => void
  onSendForHumanReview: () => void
  isSubmitting: boolean
  ticketStatus: TicketStatus
}

export function AIRecommendationCard({
  result,
  onAccept,
  onEdit,
  onSendForHumanReview,
  isSubmitting,
  ticketStatus,
}: AIRecommendationCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [category, setCategory] = useState<TicketCategory>(result.category)
  const [priority, setPriority] = useState<TicketPriority>(result.priority)
  const [assignedTeam, setAssignedTeam] = useState<AssignedTeam>(result.assigned_team)

  const evidenceCount =
    result.context_used.similar_ticket_ids.length +
    result.context_used.knowledge_document_ids.length +
    result.context_used.active_incident_ids.length
  const routingDecisionComplete = ticketStatus === "In Progress" || ticketStatus === "Resolved"
  const humanReviewActive = ticketStatus === "Needs Human Review"

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Recommendation</p>
        {result.needs_human_review && !routingDecisionComplete && (
          <span className="rounded bg-review-bg px-2 py-0.5 text-xs font-semibold text-review ring-1 ring-inset ring-review-border">
            Human review required
          </span>
        )}
      </div>

      {!isEditing ? (
        <div className="mt-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Category</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">{result.category}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Priority</dt>
              <dd className="mt-0.5">
                <PriorityBadge priority={result.priority} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Team</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">{result.assigned_team}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Confidence</dt>
              <dd className="mt-0.5">
                <ConfidenceBadge confidence={result.confidence} />
              </dd>
            </div>
          </dl>

          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Reasoning</p>
            <p className="mt-1 text-sm text-foreground">{result.reasoning}</p>
          </div>

          {result.clarification_questions.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Clarification needed</p>
              <ul className="mt-1 list-inside list-disc text-sm text-foreground">
                {result.clarification_questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Evidence used {evidenceCount > 0 ? `(${evidenceCount} items)` : "(none)"}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <li>Customer profile: {result.context_used.customer_profile_used ? "used" : "not used"}</li>
              <li>Products referenced: {result.context_used.product_ids.join(", ") || "none"}</li>
              <li>Matching incidents: {result.context_used.active_incident_ids.join(", ") || "none"}</li>
              <li>Similar past tickets: {result.context_used.similar_ticket_ids.join(", ") || "none"}</li>
              <li>Knowledge documents: {result.context_used.knowledge_document_ids.join(", ") || "none"}</li>
            </ul>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowJson((prev) => !prev)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {showJson ? "Hide raw JSON" : "View raw JSON"}
            </button>
            {showJson && (
              <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-border bg-surface-2 p-2.5 text-xs text-foreground">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>

          {ticketStatus === "In Progress" && (
            <div className="mt-3">
              <InlineFeedback tone="success" message="Routing decision confirmed. This ticket is now In Progress." />
            </div>
          )}
          {ticketStatus === "Resolved" && (
            <div className="mt-3">
              <InlineFeedback tone="success" message="This ticket is resolved. Routing actions are closed." />
            </div>
          )}
          {humanReviewActive && (
            <p className="mt-3 rounded-md border border-review-border bg-review-bg px-3 py-2 text-xs font-medium text-review">
              Human review requested. Accept or edit the routing to start work on this ticket.
            </p>
          )}

          {!routingDecisionComplete && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="primary" size="sm" disabled={isSubmitting} onClick={onAccept}>
                {isSubmitting ? "Saving..." : humanReviewActive ? "Accept & Start Work" : "Accept Routing"}
              </Button>
              <Button variant="secondary" size="sm" disabled={isSubmitting} onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <button
                type="button"
                disabled={isSubmitting || humanReviewActive}
                onClick={onSendForHumanReview}
                className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-review-border bg-review-bg px-2.5 text-xs font-medium text-review transition-colors duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {humanReviewActive ? "Review Requested" : "Human Review"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Category
            <Select value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)} className="mt-1">
              {TICKET_CATEGORIES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Priority
            <Select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)} className="mt-1">
              {TICKET_PRIORITIES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Assigned team
            <Select
              value={assignedTeam}
              onChange={(event) => setAssignedTeam(event.target.value as AssignedTeam)}
              className="mt-1"
            >
              {ASSIGNED_TEAMS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </label>
          <div className="flex gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              onClick={() => {
                onEdit({ category, priority, assignedTeam })
                setIsEditing(false)
              }}
            >
              Save changes
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
