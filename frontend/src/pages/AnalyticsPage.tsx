import { useEffect, useState } from "react"
import { ErrorState, LoadingSkeleton } from "../components/StateViews"
import { api, ApiError } from "../services/api"
import type { MetricsBreakdownEntry, MetricsDailyVolumeEntry, MetricsSummary } from "../types"

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

function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function RankedBarList({
  title,
  entries,
  total,
}: {
  title: string
  entries: MetricsBreakdownEntry[]
  total: number
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-2 text-xs text-muted-foreground">No routed tickets yet.</p>
      </div>
    )
  }

  const max = Math.max(...entries.map((entry) => entry.count), 1)

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-2.5">
        {entries.map((entry) => {
          const widthPercentage = Math.round((entry.count / max) * 100)
          const sharePercentage = total > 0 ? Math.round((entry.count / total) * 100) : 0
          return (
            <div
              key={entry.label}
              className="flex items-center gap-3"
              title={`${entry.label}: ${entry.count} ticket${entry.count === 1 ? "" : "s"} (${sharePercentage}%)`}
            >
              <span className="w-28 shrink-0 truncate text-xs text-foreground sm:w-36">{entry.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${widthPercentage}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {entry.count} ({sharePercentage}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PRIORITY_SWATCH: Record<string, string> = {
  High: "bg-danger",
  Medium: "bg-warning",
  Low: "bg-muted-foreground/40",
}

function PriorityMeter({ entries }: { entries: MetricsBreakdownEntry[] }) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tickets by priority</p>
      {total === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No routed tickets yet.</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2">
            {entries
              .filter((entry) => entry.count > 0)
              .map((entry) => (
                <div
                  key={entry.label}
                  className={`h-full first:rounded-l-full last:rounded-r-full ${PRIORITY_SWATCH[entry.label] ?? "bg-muted-foreground/40"}`}
                  style={{ width: `${(entry.count / total) * 100}%` }}
                  title={`${entry.label}: ${entry.count} (${Math.round((entry.count / total) * 100)}%)`}
                />
              ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {entries.map((entry) => (
              <span key={entry.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${PRIORITY_SWATCH[entry.label] ?? "bg-muted-foreground/40"}`} />
                {entry.label} · {entry.count} ({total > 0 ? Math.round((entry.count / total) * 100) : 0}%)
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DailyVolumeChart({ data }: { data: MetricsDailyVolumeEntry[] }) {
  const max = Math.max(...data.map((entry) => entry.count), 1)
  const hasData = data.some((entry) => entry.count > 0)

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ticket volume, last {data.length} days
      </p>
      {!hasData ? (
        <p className="mt-2 text-xs text-muted-foreground">No routed tickets in this window yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-24 items-end gap-1 sm:gap-1.5">
            {data.map((entry) => {
              const heightPercentage = entry.count > 0 ? Math.max((entry.count / max) * 100, 6) : 2
              return (
                <div
                  key={entry.date}
                  className="group flex h-24 flex-1 items-end"
                  title={`${formatShortDate(entry.date)}: ${entry.count} ticket${entry.count === 1 ? "" : "s"}`}
                >
                  <div
                    className="w-full rounded-t-sm bg-accent transition-opacity group-hover:opacity-70"
                    style={{ height: `${heightPercentage}%` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{formatShortDate(data[0].date)}</span>
            <span>{formatShortDate(data[data.length - 1].date)}</span>
          </div>
        </>
      )}
    </div>
  )
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
      <p className="mt-1 text-sm text-muted-foreground">A detailed look at how the AI router is performing.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Routed Tickets" value={String(metrics.total_routed_tickets)} />
        <StatTile label="Needs Human Review" value={`${metrics.human_review_percentage}%`} />
        <StatTile
          label="Avg. AI Routing Time"
          value={formatSeconds(metrics.avg_ai_routing_time_seconds)}
          hint="Measured from real routing calls"
        />
        <StatTile
          label="Avg. AI Confidence"
          value={metrics.avg_confidence !== null ? `${Math.round(metrics.avg_confidence * 100)}%` : "—"}
        />
      </div>

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
            : `AI routes in ${formatSeconds(metrics.avg_ai_routing_time_seconds)} vs. an estimated ${formatSeconds(metrics.estimated_manual_routing_time_seconds)} for manual triage.`}
        </p>
      </div>

      {acceptedPercentage !== null && (
        <div className="mt-4 rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Agent agreement with AI ({acceptedVsCorrectedTotal} decisions reviewed)
          </p>
          <div className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-l-full bg-accent"
              style={{ width: `${acceptedPercentage}%` }}
              title={`Accepted as-is: ${metrics.accepted_ai_decisions} (${acceptedPercentage}%)`}
            />
            <div
              className="h-full rounded-r-full bg-muted-foreground/40"
              style={{ width: `${100 - acceptedPercentage}%` }}
              title={`Corrected by an agent: ${metrics.corrected_ai_decisions} (${100 - acceptedPercentage}%)`}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Accepted · {metrics.accepted_ai_decisions} ({acceptedPercentage}%)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              Corrected · {metrics.corrected_ai_decisions} ({100 - acceptedPercentage}%)
            </span>
          </div>
        </div>
      )}

      <div className="mt-4">
        <DailyVolumeChart data={metrics.daily_volume} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RankedBarList
          title="Tickets by category"
          entries={metrics.category_breakdown}
          total={metrics.total_routed_tickets}
        />
        <RankedBarList
          title="Tickets by team"
          entries={metrics.team_breakdown}
          total={metrics.total_routed_tickets}
        />
      </div>

      <div className="mt-4">
        <PriorityMeter entries={metrics.priority_breakdown} />
      </div>
    </div>
  )
}
