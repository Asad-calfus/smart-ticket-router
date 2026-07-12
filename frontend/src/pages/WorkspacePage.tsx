import { useCallback, useEffect, useState } from "react"
import { ConversationPanel } from "../components/ConversationPanel"
import { Customer360 } from "../components/Customer360"
import { NewTicketForm } from "../components/NewTicketForm"
import { TicketQueue } from "../components/TicketQueue"
import { api, ApiError } from "../services/api"
import type {
  AssignedTeam,
  Customer,
  CustomerDetail,
  RoutingResult,
  TicketCategory,
  TicketListItem,
  TicketPriority,
  TicketQueueFilter,
  TicketRead,
} from "../types"

const EMPTY_CONTEXT_USED = {
  customer_profile_used: false,
  product_ids: [],
  active_incident_ids: [],
  similar_ticket_ids: [],
  knowledge_document_ids: [],
}

/** Builds a RoutingResult to display for a ticket that was already routed in a
 * previous session, when we don't have that session's in-memory evidence (the
 * ticket's own category/priority/etc. are persisted, but context_used ids aren't). */
function resultFromPersistedTicket(ticket: TicketRead): RoutingResult | null {
  if (!ticket.category || !ticket.priority || !ticket.assigned_team) {
    return null
  }
  return {
    category: ticket.category,
    priority: ticket.priority,
    assigned_team: ticket.assigned_team,
    reasoning: ticket.reasoning ?? "(reasoning not available for this session)",
    confidence: ticket.confidence ?? 0,
    needs_human_review: ticket.needs_human_review,
    clarification_questions: [],
    context_used: EMPTY_CONTEXT_USED,
  }
}

export function WorkspacePage() {
  const [customers, setCustomers] = useState<Customer[]>([])

  const [filter, setFilter] = useState<TicketQueueFilter>("all")
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketRead | null>(null)
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false)
  const [ticketDetailError, setTicketDetailError] = useState<string | null>(null)

  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [customerTickets, setCustomerTickets] = useState<TicketRead[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState<string | null>(null)

  const [routingResults, setRoutingResults] = useState<Record<number, RoutingResult>>({})
  const [isRouting, setIsRouting] = useState(false)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadTickets = useCallback(() => {
    setTicketsLoading(true)
    setTicketsError(null)
    api
      .getTickets(filter)
      .then(setTickets)
      .catch((err) => setTicketsError(err instanceof ApiError ? err.message : "Could not load tickets."))
      .finally(() => setTicketsLoading(false))
  }, [filter])

  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(() => setCustomers([]))
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const loadTicketDetail = useCallback((ticketId: number) => {
    setTicketDetailLoading(true)
    setTicketDetailError(null)
    api
      .getTicket(ticketId)
      .then(setSelectedTicket)
      .catch((err) => setTicketDetailError(err instanceof ApiError ? err.message : "Could not load this ticket."))
      .finally(() => setTicketDetailLoading(false))
  }, [])

  useEffect(() => {
    if (selectedTicketId !== null) {
      loadTicketDetail(selectedTicketId)
    }
  }, [selectedTicketId, loadTicketDetail])

  const loadCustomerData = useCallback((customerId: number, currentTicketId: number) => {
    setCustomerLoading(true)
    setCustomerError(null)
    Promise.all([api.getCustomer(customerId), api.getCustomerTickets(customerId)])
      .then(([customer, history]) => {
        setCustomerDetail(customer)
        setCustomerTickets(history.filter((t) => t.id !== currentTicketId))
      })
      .catch((err) => setCustomerError(err instanceof ApiError ? err.message : "Could not load customer 360 data."))
      .finally(() => setCustomerLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedTicket) {
      setCustomerDetail(null)
      setCustomerTickets([])
      return
    }
    loadCustomerData(selectedTicket.customer_id, selectedTicket.id)
    // Only re-fetch when the customer or ticket identity actually changes, not on every
    // selectedTicket field update (e.g. after routing mutates status/category in place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicket?.customer_id, selectedTicket?.id])

  function refreshAfterMutation(ticketId: number) {
    loadTickets()
    loadTicketDetail(ticketId)
  }

  async function handleRouteTicket() {
    if (!selectedTicket) return
    setIsRouting(true)
    setActionError(null)
    try {
      const result = await api.routeTicket({
        customer_id: selectedTicket.customer_id,
        message: selectedTicket.message,
        channel: selectedTicket.channel,
        ticket_id: selectedTicket.id,
      })
      setRoutingResults((prev) => ({ ...prev, [selectedTicket.id]: result }))
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not route this ticket.")
    } finally {
      setIsRouting(false)
    }
  }

  async function handleAcceptRouting() {
    if (!selectedTicket) return
    setIsSubmittingFeedback(true)
    setActionError(null)
    try {
      await api.submitFeedback(selectedTicket.id, {})
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not save this feedback.")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  async function handleEditRouting(edits: {
    category: TicketCategory
    priority: TicketPriority
    assignedTeam: AssignedTeam
  }) {
    if (!selectedTicket) return
    setIsSubmittingFeedback(true)
    setActionError(null)
    try {
      await api.submitFeedback(selectedTicket.id, {
        final_category: edits.category,
        final_priority: edits.priority,
        final_assigned_team: edits.assignedTeam,
        feedback_note: "Edited by agent",
      })
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not save this edit.")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  async function handleSendForHumanReview() {
    if (!selectedTicket) return
    setIsSubmittingFeedback(true)
    setActionError(null)
    try {
      await api.submitFeedback(selectedTicket.id, { send_for_human_review: true })
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not send this ticket for review.")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  async function handleResolveTicket(resolution: string) {
    if (!selectedTicket) return
    setActionError(null)
    try {
      await api.resolveTicket(selectedTicket.id, resolution)
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not resolve this ticket.")
    }
  }

  function handleNewTicketRouted(ticketId: number) {
    loadTickets()
    setSelectedTicketId(ticketId)
  }

  const isEvidenceLive = Boolean(selectedTicket && routingResults[selectedTicket.id])
  const displayResult = selectedTicket
    ? routingResults[selectedTicket.id] ?? resultFromPersistedTicket(selectedTicket)
    : null

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-[320px_1fr_320px]">
      <div className="flex flex-col overflow-hidden">
        <NewTicketForm customers={customers} onRouted={handleNewTicketRouted} />
        <div className="flex-1 overflow-hidden">
          <TicketQueue
            tickets={tickets}
            filter={filter}
            onFilterChange={setFilter}
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicketId}
            isLoading={ticketsLoading}
            error={ticketsError}
            onRetry={loadTickets}
          />
        </div>
      </div>

      <ConversationPanel
        ticket={selectedTicket}
        isLoading={ticketDetailLoading}
        error={ticketDetailError}
        onRetry={() => selectedTicketId && loadTicketDetail(selectedTicketId)}
        routingResult={displayResult}
        routingResultIsLive={isEvidenceLive}
        isRouting={isRouting}
        isSubmittingFeedback={isSubmittingFeedback}
        actionError={actionError}
        onRouteTicket={handleRouteTicket}
        onAcceptRouting={handleAcceptRouting}
        onEditRouting={handleEditRouting}
        onSendForHumanReview={handleSendForHumanReview}
        onResolveTicket={handleResolveTicket}
      />

      <Customer360
        customer={customerDetail}
        customerTickets={customerTickets}
        aiEvidence={displayResult}
        aiEvidenceIsLive={isEvidenceLive}
        isLoading={customerLoading}
        error={customerError}
        onRetry={() => selectedTicket && loadCustomerData(selectedTicket.customer_id, selectedTicket.id)}
      />
    </div>
  )
}
