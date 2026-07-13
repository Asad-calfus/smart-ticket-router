import { useState } from "react"
import { api, ApiError } from "../services/api"
import type { RoutingResult } from "../types"
import { PriorityBadge } from "./Badge"
import { Button } from "./ui/Button"
import { InlineFeedback } from "./ui/Toast"

interface ContextComparisonPanelProps {
  customerId: number
  message: string
  ticketId: number
}

interface ComparisonState {
  withContext: RoutingResult
  withoutContext: RoutingResult
}

function ResultColumn({ title, result }: { title: string; result: RoutingResult }) {
  return (
    <div className="flex-1 rounded-md border border-border bg-surface p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground">{result.category}</span>
        <PriorityBadge priority={result.priority} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{result.assigned_team}</p>
      <p className="mt-2 text-xs text-muted-foreground">{result.reasoning}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Evidence used: {result.context_used.similar_ticket_ids.length} similar tickets,{" "}
        {result.context_used.knowledge_document_ids.length} docs, {result.context_used.active_incident_ids.length}{" "}
        incidents
      </p>
    </div>
  )
}

export function ContextComparisonPanel({ customerId, message, ticketId }: ContextComparisonPanelProps) {
  const [comparison, setComparison] = useState<ComparisonState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runComparison() {
    setIsLoading(true)
    setError(null)
    try {
      const [withoutContext, withContext] = await Promise.all([
        api.routeTicket({ customer_id: customerId, message, ticket_id: ticketId, use_context: false, persist: false }),
        api.routeTicket({ customer_id: customerId, message, ticket_id: ticketId, use_context: true, persist: false }),
      ])
      setComparison({ withContext, withoutContext })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run the comparison.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Context Comparison Demo</h3>
          <p className="text-xs text-muted-foreground">
            See how customer profile, incidents and history change the routing decision.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={runComparison} disabled={isLoading}>
          {isLoading ? "Comparing..." : "Route Without vs With Context"}
        </Button>
      </div>

      {error && (
        <div className="mt-2">
          <InlineFeedback tone="error" message={error} />
        </div>
      )}

      {comparison && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <ResultColumn title="Without Context" result={comparison.withoutContext} />
          <ResultColumn title="With Context" result={comparison.withContext} />
        </div>
      )}
    </div>
  )
}
