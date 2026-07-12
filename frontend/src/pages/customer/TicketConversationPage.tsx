import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { PriorityBadge, StatusBadge } from "../../components/Badge"
import { ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { api, ApiError } from "../../services/api"
import type { MyTicket, TicketMessage } from "../../types"

export function TicketConversationPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const id = Number(ticketId)

  const [ticket, setTicket] = useState<MyTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reopenReason, setReopenReason] = useState("")

  function load() {
    setIsLoading(true)
    setError(null)
    Promise.all([api.getMyTicket(id), api.listMyTicketMessages(id)])
      .then(([ticketData, messageData]) => {
        setTicket(ticketData)
        setMessages(messageData)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this ticket."))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [id])

  async function handleReply(event: React.FormEvent) {
    event.preventDefault()
    if (!reply.trim()) return
    setIsSubmitting(true)
    try {
      await api.addMyTicketMessage(id, reply.trim())
      setReply("")
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your reply.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReopen() {
    if (!reopenReason.trim()) return
    setIsSubmitting(true)
    try {
      await api.reopenMyTicket(id, reopenReason.trim())
      setReopenReason("")
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reopen this ticket.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={5} />
  if (error && !ticket) return <ErrorState message={error} onRetry={load} />
  if (!ticket) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Ticket #{ticket.id}</h2>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <PriorityBadge priority={ticket.priority} />
        {ticket.category && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{ticket.category}</span>}
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Original message</p>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.message}</p>
      </div>

      <div className="mt-4 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg border p-3 text-sm ${
              message.message_type === "Customer Reply"
                ? "ml-8 border-blue-200 bg-blue-50"
                : "mr-8 border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs font-medium text-slate-500">
              {message.message_type === "Customer Reply" ? "You" : message.author_label} &middot;{" "}
              {new Date(message.created_at).toLocaleString()}
            </p>
            <p className="mt-1 text-slate-700">{message.body}</p>
          </div>
        ))}
      </div>

      {ticket.resolution && (
        <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Resolution</p>
          <p className="mt-1">{ticket.resolution}</p>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      {ticket.status === "Resolved" ? (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-700">Not fixed? Reopen this ticket</p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            rows={2}
            placeholder="What's still wrong?"
            className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
          />
          <button
            type="button"
            onClick={handleReopen}
            disabled={isSubmitting || !reopenReason.trim()}
            className="mt-2 rounded bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Reopen Ticket
          </button>
        </div>
      ) : (
        <form onSubmit={handleReply} className="mt-4 rounded-lg border border-slate-200 p-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Write a reply..."
            className="w-full rounded border border-slate-300 p-2 text-sm"
          />
          <button
            type="submit"
            disabled={isSubmitting || !reply.trim()}
            className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send Reply
          </button>
        </form>
      )}
    </div>
  )
}
