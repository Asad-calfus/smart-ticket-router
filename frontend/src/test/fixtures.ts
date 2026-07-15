import type { Customer, CustomerDetail, RoutingResult, TicketListItem, TicketRead } from "../types"

export const sampleRoutingResult: RoutingResult = {
  category: "Account Access",
  priority: "High",
  assigned_team: "Identity and Access",
  secondary_teams: [],
  reasoning: "Payment succeeded but purchased product access is inactive.",
  confidence: 0.92,
  needs_human_review: false,
  clarification_questions: [],
  context_used: {
    customer_profile_used: true,
    product_ids: [1, 2],
    active_incident_ids: [],
    similar_ticket_ids: [3, 4],
    knowledge_document_ids: [1],
  },
}

export const sampleCustomer: Customer = {
  id: 1,
  name: "Ananya Sharma",
  email: "ananya.sharma@example.com",
  tier: "Premium",
  location: "Mumbai, India",
  preferred_language: "Hindi",
  created_at: "2026-01-01T00:00:00Z",
}

export const sampleCustomerDetail: CustomerDetail = {
  ...sampleCustomer,
  products: [
    {
      product_id: 1,
      product_name: "Premium Dashboard",
      plan_name: "Premium Yearly",
      subscription_status: "Active",
      access_status: "Active",
      expiry_date: "2027-01-01",
    },
  ],
  active_incidents: [],
}

export const sampleTicketListItem: TicketListItem = {
  id: 1,
  customer_id: 1,
  customer_name: "Ananya Sharma",
  message_preview: "Premium Dashboard is not opening.",
  channel: "Email",
  category: null,
  priority: null,
  assigned_team: null,
  secondary_teams: [],
  status: "Open",
  confidence: null,
  needs_human_review: false,
  waiting_minutes: 5,
  created_at: "2026-01-01T00:00:00Z",
}

export const sampleTicketRead: TicketRead = {
  id: 1,
  customer_id: 1,
  customer_name: "Ananya Sharma",
  message: "Premium Dashboard is not opening.",
  channel: "Email",
  category: null,
  priority: null,
  assigned_team: null,
  secondary_teams: [],
  reasoning: null,
  confidence: null,
  needs_human_review: false,
  status: "Open",
  resolution: null,
  created_at: "2026-01-01T00:00:00Z",
  resolved_at: null,
  human_verified: false,
  routing_time_ms: null,
}
