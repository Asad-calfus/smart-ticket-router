import { useEffect, useState } from "react"
import { ErrorState, LoadingSkeleton } from "../components/StateViews"
import { api, ApiError } from "../services/api"
import type { MetricsSummary } from "../types"

function EstimatedTag() {
  return (
    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Estimated
    </span>
  )
}

function StatTile({
  label,
  value,
  hint,
  estimated,
}: {
  label: string
  value: string
  hint?: string
  estimated?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {estimated && <EstimatedTag />}
      </div>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—"
  if (seconds < 1) {
    const ms = Math.round(seconds * 1000)
    return ms < 1 ? "<1ms" : `${ms}ms`
  }
  return `${seconds.toFixed(1)}s`
}

export function AnalyticsPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setIsLoading(true)
    setError(null)
    api
      .getMetricsSummary()
      .then(setMetrics)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load metrics."))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  if (isLoading) {
    return <LoadingSkeleton rows={4} />
  }

  if (error || !metrics) {
    return (
      <div className="p-6">
        <ErrorState message={error ?? "No metrics available."} onRetry={load} />
      </div>
    )
  }

  const acceptedVsCorrectedTotal = metrics.accepted_ai_decisions + metrics.corrected_ai_decisions
  const acceptedPercentage =
    acceptedVsCorrectedTotal > 0 ? Math.round((metrics.accepted_ai_decisions / acceptedVsCorrectedTotal) * 100) : null

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-foreground">Routing Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">A quick summary of how the AI router is performing.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total Routed Tickets" value={String(metrics.total_routed_tickets)} />
        <StatTile label="Needs Human Review" value={`${metrics.human_review_percentage}%`} />
        <StatTile label="Accepted AI Decisions" value={String(metrics.accepted_ai_decisions)} />
        <StatTile label="Corrected AI Decisions" value={String(metrics.corrected_ai_decisions)} />
        <StatTile
          label="Avg. AI Routing Time"
          value={formatSeconds(metrics.avg_ai_routing_time_seconds)}
          hint="Measured from real routing calls made this session"
        />
        <StatTile
          label="Manual Routing Time"
          value={formatSeconds(metrics.estimated_manual_routing_time_seconds)}
          hint="Industry-standard manual triage assumption"
          estimated={metrics.manual_routing_time_is_estimated}
        />
      </div>

      {acceptedPercentage !== null && (
        <div className="mt-4 rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Agent agreement with AI ({acceptedVsCorrectedTotal} decisions reviewed)
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${acceptedPercentage}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {acceptedPercentage}% accepted as-is, {100 - acceptedPercentage}% corrected by an agent.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-md border border-border bg-surface p-4">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estimated time saved per ticket
          </p>
          <EstimatedTag />
        </div>
        <p className="mt-1 text-2xl font-semibold text-foreground">
          {formatSeconds(metrics.estimated_time_saved_seconds)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {metrics.avg_ai_routing_time_seconds === null
            ? "Route at least one ticket to see a measured comparison."
            : "Estimated manual routing time minus measured AI routing time."}
        </p>
      </div>
    </div>
  )
}
