import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Textarea } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
import { api, ApiError } from "../../services/api"

const MESSAGE_MAX_LENGTH = 4000

export function NewTicketPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const ticket = await api.createMyTicket({ message: message.trim(), channel: "Portal" })
      navigate(`/tickets/${ticket.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your ticket.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">New Support Ticket</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Describe your issue. We will create the ticket immediately and route it with AI in the background.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-lg space-y-3 rounded-lg border border-border bg-surface p-4">
        <label htmlFor="ticket-message" className="block text-xs font-medium text-muted-foreground">
          Message
        </label>
        <Textarea
          id="ticket-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={MESSAGE_MAX_LENGTH}
          required
          placeholder="What's going on?"
        />
        <p className="-mt-2 text-right text-xs text-muted-foreground">
          {message.length} / {MESSAGE_MAX_LENGTH}
        </p>
        {error && <InlineFeedback tone="error" message={error} />}
        <Button type="submit" variant="primary" disabled={isSubmitting || !message.trim()}>
          {isSubmitting ? "Creating ticket..." : "Submit Ticket"}
        </Button>
      </form>
    </div>
  )
}
