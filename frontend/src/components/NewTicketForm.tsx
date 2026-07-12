import { useState } from "react"
import { api, ApiError } from "../services/api"
import type { Customer, TicketChannel } from "../types"

const CHANNELS: TicketChannel[] = ["Email", "Chat", "Phone", "Portal"]

interface NewTicketFormProps {
  customers: Customer[]
  onRouted: (ticketId: number) => void
}

export function NewTicketForm({ customers, onRouted }: NewTicketFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customerId, setCustomerId] = useState<number | "">("")
  const [channel, setChannel] = useState<TicketChannel>("Email")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (customerId === "" || !message.trim()) return

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await api.routeTicket({ customer_id: customerId, message: message.trim(), channel })
      setMessage("")
      setIsOpen(false)
      onRouted(result.ticket_id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit this ticket.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="m-3 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
      >
        + New Ticket
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="m-3 space-y-2 rounded-md border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-600">Submit a new support message</p>
      <select
        aria-label="Customer"
        value={customerId}
        onChange={(event) => setCustomerId(event.target.value ? Number(event.target.value) : "")}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        required
      >
        <option value="">Select customer...</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Channel"
        value={channel}
        onChange={(event) => setChannel(event.target.value as TicketChannel)}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        {CHANNELS.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Describe the issue..."
        rows={3}
        maxLength={4000}
        className="w-full rounded border border-slate-300 p-2 text-sm"
        required
      />
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Routing..." : "Submit & Route"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
