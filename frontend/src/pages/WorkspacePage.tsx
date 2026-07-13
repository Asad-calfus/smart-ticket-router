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

type MobilePane = "queue" | "conversation" | "customer"

const MOBILE_PANES: { key: MobilePane; label: string }[] = [
  { key: "queue", label: "Queue" },
  { key: "conversation", label: "Conversation" },
  { key: "customer", label: "Customer 360" },
]

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

  // Which pane is visible on narrow (< lg) viewports, where the three columns
  // can't all fit side by side. Purely a presentation concern — desktop always
  // shows all three columns regardless of this value.
  const [mobilePane, setMobilePane] = useState<MobilePane>("conversation")

  // Evidence for the currently selected ticket: freshly-routed results this
  // session take priority; otherwise fall back to what's persisted in the DB
  // (see GET /api/tickets/{id}/evidence) — both are equally "real" evidence.
  const [routingResults, setRoutingResults] = useState<Record<number, RoutingResult>>({})
  const [persistedEvidence, setPersistedEvidence] = useState<Record<number, RoutingResult>>({})
  const [isRouting, setIsRouting] = useState(false)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    setActionError(null)
    setActionSuccess(null)
  }, [selectedTicketId])

  const loadTickets = useCallback((showLoading = true) => {
    if (showLoading) setTicketsLoading(true)
    if (showLoading) setTicketsError(null)
    api
      .getTickets(filter)
      .then(setTickets)
      .catch((err) => setTicketsError(err instanceof ApiError ? err.message : "Could not load tickets."))
      .finally(() => {
        if (showLoading) setTicketsLoading(false)
      })
  }, [filter])

  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(() => setCustomers([]))
    api.getAgentRoster().then(setAgentRoster).catch(() => setAgentRoster([]))
  }, [])

  useEffect(() => {
    loadTickets()
    const refreshTimer = window.setInterval(() => loadTickets(false), 5000)
    return () => window.clearInterval(refreshTimer)
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
    setActionSuccess(null)
    try {
      const result = await api.routeTicket({
        customer_id: selectedTicket.customer_id,
        message: selectedTicket.message,
        channel: selectedTicket.channel,
        ticket_id: selectedTicket.id,
      })
      setRoutingResults((prev) => ({ ...prev, [selectedTicket.id]: result }))
      setActionSuccess("AI routing completed. Review the recommendation below.")
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
    setActionSuccess(null)
    try {
      await api.submitFeedback(selectedTicket.id, {})
      setActionSuccess("Routing accepted. The ticket is now In Progress.")
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
    setActionSuccess(null)
    try {
      await api.submitFeedback(selectedTicket.id, {
        final_category: edits.category,
        final_priority: edits.priority,
        final_assigned_team: edits.assignedTeam,
        feedback_note: "Edited by agent",
      })
      setActionSuccess("Routing changes saved. The ticket is now In Progress.")
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
    setActionSuccess(null)
    try {
      await api.submitFeedback(selectedTicket.id, { send_for_human_review: true })
      setActionSuccess("Human review requested. The ticket status has been updated.")
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
    setActionSuccess(null)
    try {
      await api.resolveTicket(selectedTicket.id, resolution)
      setActionSuccess("Ticket resolved successfully.")
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not resolve this ticket.")
    }
  }

  async function handleSendMessage(body: string, messageType: "Agent Reply" | "Internal Note") {
    if (!selectedTicket) return
    setActionError(null)
    setActionSuccess(null)
    try {
      await api.addTicketMessage(selectedTicket.id, body, messageType)
      setActionSuccess(messageType === "Internal Note" ? "Internal note saved." : "Reply sent to the customer.")
      loadMessages(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not send this message.")
    }
  }

  async function handleAssign(agentUserId: number) {
    if (!selectedTicket) return
    setActionError(null)
    setActionSuccess(null)
    try {
      await api.assignTicket(selectedTicket.id, agentUserId)
      setActionSuccess("Ticket assigned successfully.")
      refreshAfterMutation(selectedTicket.id)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not assign this ticket.")
    }
  }

  function handleNewTicketRouted(ticketId: number) {
    loadTickets()
    setSelectedTicketId(ticketId)
    setMobilePane("conversation")
  }

  function handleSelectTicket(ticketId: number) {
    setSelectedTicketId(ticketId)
    setMobilePane("conversation")
  }

  const displayResult = selectedTicket
    ? routingResults[selectedTicket.id] ?? persistedEvidence[selectedTicket.id] ?? null
    : null

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5 lg:hidden">
        {MOBILE_PANES.map((pane) => (
          <button
            key={pane.key}
            type="button"
            onClick={() => setMobilePane(pane.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
              mobilePane === pane.key
                ? "bg-accent-subtle text-accent"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {pane.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`${
            mobilePane === "queue" ? "flex" : "hidden"
          } w-full flex-col overflow-hidden border-r border-border bg-surface lg:flex lg:w-[280px] lg:shrink-0`}
        >
          <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {user?.agent_display_name ?? user?.email} {user?.agent_team ? `· ${user.agent_team}` : ""}
          </div>
          <NewTicketForm customers={customers} onRouted={handleNewTicketRouted} />
          <div className="flex-1 overflow-hidden">
            <TicketQueue
              tickets={tickets}
              filter={filter}
              onFilterChange={setFilter}
              selectedTicketId={selectedTicketId}
              onSelectTicket={handleSelectTicket}
              isLoading={ticketsLoading}
              error={ticketsError}
              onRetry={loadTickets}
            />
          </div>
        </div>

        <div className={`${mobilePane === "conversation" ? "flex" : "hidden"} min-w-0 flex-1 flex-col overflow-hidden lg:flex`}>
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
            actionSuccess={actionSuccess}
            onRouteTicket={handleRouteTicket}
            onAcceptRouting={handleAcceptRouting}
            onEditRouting={handleEditRouting}
            onSendForHumanReview={handleSendForHumanReview}
            onResolveTicket={handleResolveTicket}
          />
        </div>

        <div
          className={`${
            mobilePane === "customer" ? "flex" : "hidden"
          } w-full flex-col overflow-hidden border-l border-border bg-surface lg:flex lg:w-[320px] lg:shrink-0`}
        >
          <Customer360
            customer={customerDetail}
            customerTickets={customerTickets}
            aiEvidence={displayResult}
            isLoading={customerLoading}
            error={customerError}
            onRetry={() => selectedTicket && loadCustomerData(selectedTicket.customer_id, selectedTicket.id)}
          />
        </div>
      </div>
    </div>
  )
}
