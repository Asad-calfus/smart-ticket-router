import { useEffect, useState } from "react"
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { api, ApiError } from "../../services/api"
import type { AuditEventRead } from "../../types"

export function AuditLogPage() {
  const [events, setEvents] = useState<AuditEventRead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setIsLoading(true)
    setError(null)
    api
      .listAuditLog()
      .then(setEvents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the audit log."))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
      <p className="mt-1 text-sm text-muted-foreground">A record of administrative actions taken across the workspace.</p>

      <div className="mt-4">
        {isLoading && <LoadingSkeleton rows={6} />}
        {!isLoading && error && <ErrorState message={error} onRetry={load} />}
        {!isLoading && !error && events.length === 0 && (
          <EmptyState title="No audit events yet" description="Administrative actions will appear here as they happen." />
        )}
        {!isLoading && !error && events.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {events.map((event) => (
              <li key={event.id} className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{event.action}</span>
                  <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Actor: {event.actor_email ?? "system"}
                  {event.target_type && ` · Target: ${event.target_type}${event.target_id ? ` #${event.target_id}` : ""}`}
                </p>
                {event.event_metadata && (
                  <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(event.event_metadata, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
