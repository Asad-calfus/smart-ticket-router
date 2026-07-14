import type {
  AcceptInvitationRequest,
  AgentInviteRequest,
  AgentRosterItem,
  AgentUser,
  AuditEventRead,
  CurrentUser,
  Customer,
  CustomerDetail,
  GenericMessage,
  LLMProviderName,
  LoginRequest,
  MetricsSummary,
  ModelListResponse,
  MyProfile,
  MyProfileUpdate,
  MyTicket,
  MyTicketCreate,
  RoutingEvidenceRead,
  SignupRequest,
  TicketAssignmentRead,
  TicketFeedbackCreate,
  TicketFeedbackRead,
  TicketListItem,
  TicketMessage,
  TicketQueueFilter,
  TicketRead,
  TicketRouteRequest,
  TicketRouteResponse,
  UserLLMSettingsRead,
  UserLLMSettingsUpdate,
} from "../types"

// Empty by default so local development uses Vite's same-origin `/api` proxy.
// Production deployments can still provide an explicit API origin.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase()
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  // Double-submit CSRF: echo the (non-HttpOnly) csrf cookie back as a header
  // on any state-changing request — see backend app/api/deps.py.
  if (!SAFE_METHODS.has(method)) {
    const csrfToken = readCookie("csrf_token")
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include", // send/receive the HttpOnly session cookie
      headers,
      ...options,
    })
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0)
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status}).`
    try {
      const body = await response.json()
      if (typeof body.detail === "string") {
        detail = body.detail
      } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        detail = body.detail.map((item: { msg: string }) => item.msg).join(" ")
      }
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    throw new ApiError(detail, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export const api = {
  // --- Auth -------------------------------------------------------------------
  signup: (payload: SignupRequest) => request<CurrentUser>("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: LoginRequest) => request<CurrentUser>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<GenericMessage>("/api/auth/logout", { method: "POST" }),
  me: () => request<CurrentUser>("/api/auth/me"),
  forgotPassword: (email: string) =>
    request<GenericMessage>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, new_password: string) =>
    request<GenericMessage>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) }),
  verifyEmail: (token: string) =>
    request<GenericMessage>("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  changePassword: (current_password: string, new_password: string) =>
    request<GenericMessage>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  acceptInvitation: (payload: AcceptInvitationRequest) =>
    request<CurrentUser>("/api/auth/accept-invitation", { method: "POST", body: JSON.stringify(payload) }),

  // --- Customer portal ----------------------------------------------------------
  getMyProfile: () => request<MyProfile>("/api/profile"),
  updateMyProfile: (payload: MyProfileUpdate) =>
    request<MyProfile>("/api/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  createMyTicket: (payload: MyTicketCreate) =>
    request<MyTicket>("/api/my/tickets", { method: "POST", body: JSON.stringify(payload) }),
  listMyTickets: () => request<MyTicket[]>("/api/my/tickets"),
  getMyTicket: (ticketId: number) => request<MyTicket>(`/api/my/tickets/${ticketId}`),
  listMyTicketMessages: (ticketId: number) => request<TicketMessage[]>(`/api/my/tickets/${ticketId}/messages`),
  addMyTicketMessage: (ticketId: number, body: string) =>
    request<TicketMessage>(`/api/my/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  reopenMyTicket: (ticketId: number, reason: string) =>
    request<MyTicket>(`/api/my/tickets/${ticketId}/reopen`, { method: "POST", body: JSON.stringify({ reason }) }),

  // --- Agent workspace ------------------------------------------------------------
  getCustomers: () => request<Customer[]>("/api/customers"),
  getCustomer: (customerId: number) => request<CustomerDetail>(`/api/customers/${customerId}`),
  getCustomerTickets: (customerId: number) => request<TicketRead[]>(`/api/customers/${customerId}/tickets`),

  getTickets: (filter: TicketQueueFilter = "all") =>
    request<TicketListItem[]>(`/api/tickets?filter=${encodeURIComponent(filter)}`),
  getTicket: (ticketId: number) => request<TicketRead>(`/api/tickets/${ticketId}`),

  routeTicket: (payload: TicketRouteRequest) =>
    request<TicketRouteResponse>("/api/tickets/route", { method: "POST", body: JSON.stringify(payload) }),

  submitFeedback: (ticketId: number, payload: TicketFeedbackCreate) =>
    request<TicketFeedbackRead>(`/api/tickets/${ticketId}/feedback`, { method: "POST", body: JSON.stringify(payload) }),

  resolveTicket: (ticketId: number, resolution: string) =>
    request<TicketRead>(`/api/tickets/${ticketId}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }),

  listTicketMessages: (ticketId: number) => request<TicketMessage[]>(`/api/tickets/${ticketId}/messages`),
  addTicketMessage: (ticketId: number, bodyText: string, messageType: "Agent Reply" | "Internal Note") =>
    request<TicketMessage>(`/api/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: bodyText, message_type: messageType }),
    }),
  assignTicket: (ticketId: number, agentUserId: number) =>
    request<TicketAssignmentRead>(`/api/tickets/${ticketId}/assign`, {
      method: "POST",
      body: JSON.stringify({ agent_user_id: agentUserId }),
    }),
  getTicketEvidence: (ticketId: number) => request<RoutingEvidenceRead>(`/api/tickets/${ticketId}/evidence`),
  getAgentRoster: () => request<AgentRosterItem[]>("/api/tickets/agents/roster"),

  getMetricsSummary: () => request<MetricsSummary>("/api/metrics/summary"),

  // --- Personal LLM settings ---------------------------------------------------
  getMyLlmSettings: () => request<UserLLMSettingsRead>("/api/me/llm-settings"),
  saveMyLlmSettings: (payload: UserLLMSettingsUpdate) =>
    request<UserLLMSettingsRead>("/api/me/llm-settings", { method: "PUT", body: JSON.stringify(payload) }),
  getLlmProviderDefaults: () => request<Record<string, string>>("/api/me/llm-settings/defaults"),
  listLlmModels: (provider: LLMProviderName, apiKey?: string) =>
    request<ModelListResponse>("/api/me/llm-settings/models", {
      method: "POST",
      body: JSON.stringify({ provider, api_key: apiKey || undefined }),
    }),

  // --- Admin ------------------------------------------------------------------
  inviteAgent: (payload: AgentInviteRequest) =>
    request<GenericMessage>("/api/admin/agents/invite", { method: "POST", body: JSON.stringify(payload) }),
  listAgents: () => request<AgentUser[]>("/api/admin/agents"),
  activateAgent: (userId: number) => request<AgentUser>(`/api/admin/agents/${userId}/activate`, { method: "POST" }),
  deactivateAgent: (userId: number) => request<AgentUser>(`/api/admin/agents/${userId}/deactivate`, { method: "POST" }),
  updateAgent: (userId: number, payload: { role?: string; team?: string | null }) =>
    request<AgentUser>(`/api/admin/agents/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listAuditLog: () => request<AuditEventRead[]>("/api/admin/audit-log"),
}
