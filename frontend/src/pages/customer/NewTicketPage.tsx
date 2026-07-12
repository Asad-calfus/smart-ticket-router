import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api, ApiError } from "../../services/api"

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
      <h2 className="text-lg font-semibold text-slate-800">New Support Ticket</h2>
      <p className="mt-1 text-sm text-slate-500">Describe your issue and we'll route it to the right team.</p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-lg space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-xs font-medium text-slate-600">
          Message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={4000}
            required
            placeholder="What's going on?"
            className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
          />
        </label>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || !message.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit Ticket"}
        </button>
      </form>
    </div>
  )
}
