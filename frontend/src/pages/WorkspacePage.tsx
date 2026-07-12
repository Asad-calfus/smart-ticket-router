import { useCallback, useEffect, useState } from "react"
import { ConversationPanel } from "../components/ConversationPanel"
import { Customer360 } from "../components/Customer360"
import { NewTicketForm } from "../components/NewTicketForm"
import { TicketQueue } from "../components/TicketQueue"
import { useAuth } from "../contexts/AuthContext"
import { api, ApiError } from "../services/api"
import type {
  AgentRosterItem,
  AssignedTeam,
  Customer,
  CustomerDetail,
  RoutingResult,
  TicketCategory,
  TicketListItem,
  TicketMessage,
  TicketPriority,
  TicketQueueFilter,
  TicketRead,
} from "../types"

export function WorkspacePage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [agentRoster, setAgentRoster] = useState<AgentRosterItem[]>([])

  const [filter, setFilter] = useState<TicketQueueFilter>("all")
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketRead | null>(null)
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false)
  const [ticketDetailError, setTicketDetailError] = useState<string | null>(null)

  const [messages, setMessages] = useState<TicketMessage[]>([])

  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [customerTickets, setCustomerTickets] = useState<TicketRead[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerError, setCustomerError] = useState<string | null>(null)

  // Evidence for the currently selected ticket: freshly-routed results this
  // session take priority; otherwise fall back to what's persisted in the DB
  // (see GET /api/tickets/{id}/evidence) — both are equally "real" evidence.
  const [routingResults, setRoutingResults] = useState<Record<number, RoutingResult>>({})
  const [persistedEvidence, setPersistedEvidence] = useState<Record<number, RoutingResult>>({})
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
    api.getAgentRoster().then(setAgentRoster).catch(() => setAgentRoster([]))
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

  const loadMessages = useCallback((ticketId: number) => {
    api.listTicketMessages(ticketId).then(setMessages).catch(() => setMessages([]))
  }, [])

  const loadEvidence = useCallback((ticketId: number) => {
    api
      .getTicketEvidence(ticketId)
      .then((evidence) => setPersistedEvidence((prev) => ({ ...prev, [ticketId]: evidence })))
      .catch(() => {
        /* not routed yet — no evidence to show, which is fine */
      })
  }, [])

  useEffect(() => {
    if (selectedTicketId !== null) {
      loadTicketDetail(selectedTicketId)
      loadMessages(selectedTicketId)
      loadEvidence(selectedTicketId)
    }
  }, [selectedTicketId, loadTicketDetail, loadMessages, loadEvidence])

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

  async function handleSendMessage(body: string, messageType: "Agent Reply" | "Internal Note") {
    if (!selectedTicket) return
    setActionError(null)
    try {
      await api.addTicketMessage(selectedTicket.id, body, messageType)
      loadMessages(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not send this message.")
    }
  }

  async function handleAssign(agentUserId: number) {
    if (!selectedTicket) return
    setActionError(null)
    try {
      await api.assignTicket(selectedTicket.id, agentUserId)
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not assign this ticket.")
    }
  }

  function handleNewTicketRouted(ticketId: number) {
    loadTickets()
    setSelectedTicketId(ticketId)
  }

  const displayResult = selectedTicket
    ? routingResults[selectedTicket.id] ?? persistedEvidence[selectedTicket.id] ?? null
    : null

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-[320px_1fr_320px]">
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
          <span>
            {user?.agent_display_name ?? user?.email} {user?.agent_team ? `· ${user.agent_team}` : ""}
          </span>
        </div>
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
        messages={messages}
        agentRoster={agentRoster}
        onAssign={handleAssign}
        onSendMessage={handleSendMessage}
        routingResult={displayResult}
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
        isLoading={customerLoading}
        error={customerError}
        onRetry={() => selectedTicket && loadCustomerData(selectedTicket.customer_id, selectedTicket.id)}
      />
    </div>
  )
}
