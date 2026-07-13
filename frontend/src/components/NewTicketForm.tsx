import { useState } from "react"
import { Plus } from "lucide-react"
import { api, ApiError } from "../services/api"
import type { Customer, TicketChannel } from "../types"
import { Button } from "./ui/Button"
import { Select, Textarea } from "./ui/Input"
import { InlineFeedback } from "./ui/Toast"

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
      <div className="m-3">
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setIsOpen(true)}>
          New Ticket
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="m-3 space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground">Submit a new support message</p>
      <Select
        aria-label="Customer"
        value={customerId}
        onChange={(event) => setCustomerId(event.target.value ? Number(event.target.value) : "")}
        required
      >
        <option value="">Select customer...</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </Select>
      <Select aria-label="Channel" value={channel} onChange={(event) => setChannel(event.target.value as TicketChannel)}>
        {CHANNELS.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </Select>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Describe the issue..."
        rows={3}
        maxLength={4000}
        required
      />
      {error && <InlineFeedback tone="error" message={error} />}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Routing..." : "Submit & Route"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
