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
      <h2 className="text-lg font-semibold text-slate-800">Audit Log</h2>

      <div className="mt-4">
        {isLoading && <LoadingSkeleton rows={6} />}
        {!isLoading && error && <ErrorState message={error} onRetry={load} />}
        {!isLoading && !error && events.length === 0 && <EmptyState title="No audit events yet" />}
        {!isLoading && !error && events.length > 0 && (
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{event.action}</span>
                  <span className="text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Actor: {event.actor_email ?? "system"}
                  {event.target_type && ` · Target: ${event.target_type}${event.target_id ? ` #${event.target_id}` : ""}`}
                </p>
                {event.event_metadata && (
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-500">
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
