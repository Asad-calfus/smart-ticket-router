import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Info } from "lucide-react"
import { PriorityBadge, StatusBadge } from "../../components/Badge"
import { ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { Textarea } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
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

  useEffect(() => {
    if (!ticket || ticket.status !== "Open" || ticket.category !== null) return

    const routingPoll = window.setInterval(() => {
      api
        .getMyTicket(id)
        .then(setTicket)
        .catch(() => {
          // A temporary polling failure should not replace the ticket page
          // with an error; the next poll or manual navigation can recover.
        })
    }, 2000)

    return () => window.clearInterval(routingPoll)
  }, [id, ticket])

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
        <h2 className="text-lg font-semibold text-foreground">Ticket #{ticket.id}</h2>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <PriorityBadge priority={ticket.priority} />
        {ticket.category && (
          <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">{ticket.category}</span>
        )}
      </div>

      {ticket.status === "Open" && ticket.category === null && (
        <div role="status" className="mt-4 flex items-start gap-2 rounded-md border border-accent-subtle bg-accent-subtle p-3 text-sm text-accent">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Ticket submitted successfully</p>
            <p className="mt-1 text-xs">AI routing is in progress. This page updates automatically.</p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original message</p>
        <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.message}</p>
      </div>

      <div className="mt-4 space-y-2">
        {messages.map((message) => {
          const isCustomer = message.message_type === "Customer Reply"
          return (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-lg border p-3 text-sm ${
                isCustomer ? "ml-auto border-accent-subtle bg-accent-subtle" : "mr-auto border-border bg-surface"
              }`}
            >
              <p className="text-xs font-medium text-muted-foreground">
                {isCustomer ? "You" : message.author_label} &middot; {new Date(message.created_at).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{message.body}</p>
            </div>
          )
        })}
      </div>

      {ticket.resolution && (
        <div className="mt-4 rounded-md border border-success-border bg-success-bg p-3 text-sm text-success">
          <p className="text-xs font-semibold uppercase tracking-wide">Resolution</p>
          <p className="mt-1 whitespace-pre-wrap">{ticket.resolution}</p>
        </div>
      )}

      {error && <div className="mt-3"><InlineFeedback tone="error" message={error} /></div>}

      {ticket.status === "Resolved" ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3">
          <p className="text-sm font-semibold text-foreground">Not fixed? Reopen this ticket</p>
          <Textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            rows={2}
            placeholder="What's still wrong?"
            className="mt-2"
          />
          <Button
            type="button"
            variant="danger"
            onClick={handleReopen}
            disabled={isSubmitting || !reopenReason.trim()}
            className="mt-2"
          >
            Reopen Ticket
          </Button>
        </div>
      ) : (
        <form onSubmit={handleReply} className="mt-4 rounded-lg border border-border bg-surface p-3">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Write a reply..."
          />
          <Button type="submit" variant="primary" disabled={isSubmitting || !reply.trim()} className="mt-2">
            Send Reply
          </Button>
        </form>
      )}
    </div>
  )
}
