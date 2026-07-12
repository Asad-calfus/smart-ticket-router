import type {
  Customer,
  CustomerDetail,
  Incident,
  MetricsSummary,
  TicketFeedbackCreate,
  TicketFeedbackRead,
  TicketListItem,
  TicketQueueFilter,
  TicketRead,
  TicketRouteRequest,
  TicketRouteResponse,
} from "../types"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
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
  getCustomers: () => request<Customer[]>("/api/customers"),
  getCustomer: (customerId: number) => request<CustomerDetail>(`/api/customers/${customerId}`),
  getCustomerTickets: (customerId: number) => request<TicketRead[]>(`/api/customers/${customerId}/tickets`),

  getTickets: (filter: TicketQueueFilter = "all") =>
    request<TicketListItem[]>(`/api/tickets?filter=${encodeURIComponent(filter)}`),
  getTicket: (ticketId: number) => request<TicketRead>(`/api/tickets/${ticketId}`),

  routeTicket: (payload: TicketRouteRequest) =>
    request<TicketRouteResponse>("/api/tickets/route", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitFeedback: (ticketId: number, payload: TicketFeedbackCreate) =>
    request<TicketFeedbackRead>(`/api/tickets/${ticketId}/feedback`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resolveTicket: (ticketId: number, resolution: string) =>
    request<TicketRead>(`/api/tickets/${ticketId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),

  getActiveIncidents: () => request<Incident[]>("/api/incidents/active"),
  getMetricsSummary: () => request<MetricsSummary>("/api/metrics/summary"),
}
