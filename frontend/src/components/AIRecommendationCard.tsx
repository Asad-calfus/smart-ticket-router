import { useState } from "react"
import type { AssignedTeam, RoutingResult, TicketCategory, TicketPriority } from "../types"
import { ASSIGNED_TEAMS, TICKET_CATEGORIES, TICKET_PRIORITIES } from "../types"
import { ConfidenceBadge, PriorityBadge } from "./Badge"

interface AIRecommendationCardProps {
  result: RoutingResult
  onAccept: () => void
  onEdit: (edits: { category: TicketCategory; priority: TicketPriority; assignedTeam: AssignedTeam }) => void
  onSendForHumanReview: () => void
  isSubmitting: boolean
}

export function AIRecommendationCard({
  result,
  onAccept,
  onEdit,
  onSendForHumanReview,
  isSubmitting,
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

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">AI Recommendation</h3>
        {result.needs_human_review && (
          <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
            Human review required
          </span>
        )}
      </div>

      {!isEditing ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {result.category}
            </span>
            <PriorityBadge priority={result.priority} />
            <span className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {result.assigned_team}
            </span>
            <ConfidenceBadge confidence={result.confidence} />
          </div>
          <p className="text-sm text-slate-600">{result.reasoning}</p>

          {result.clarification_questions.length > 0 && (
            <div className="rounded-md bg-white p-2.5 ring-1 ring-slate-200">
              <p className="text-xs font-semibold text-slate-600">Clarification needed:</p>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                {result.clarification_questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md bg-white p-2.5 text-xs text-slate-600 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-600">
              Evidence used {evidenceCount > 0 ? `(${evidenceCount} items)` : "(none)"}:
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>Customer profile: {result.context_used.customer_profile_used ? "used" : "not used"}</li>
              <li>Products referenced: {result.context_used.product_ids.join(", ") || "none"}</li>
              <li>Matching incidents: {result.context_used.active_incident_ids.join(", ") || "none"}</li>
              <li>Similar past tickets: {result.context_used.similar_ticket_ids.join(", ") || "none"}</li>
              <li>Knowledge documents: {result.context_used.knowledge_document_ids.join(", ") || "none"}</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setShowJson((prev) => !prev)}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            {showJson ? "Hide" : "View"} JSON
          </button>
          {showJson && (
            <pre className="max-h-56 overflow-auto rounded-md bg-slate-900 p-2.5 text-xs text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onAccept}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Accept Routing
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsEditing(true)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onSendForHumanReview}
              className="rounded border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
            >
              Human Review
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          <label className="block text-xs font-medium text-slate-600">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as TicketCategory)}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {TICKET_CATEGORIES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {TICKET_PRIORITIES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Assigned team
            <select
              value={assignedTeam}
              onChange={(event) => setAssignedTeam(event.target.value as AssignedTeam)}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {ASSIGNED_TEAMS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                onEdit({ category, priority, assignedTeam })
                setIsEditing(false)
              }}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
