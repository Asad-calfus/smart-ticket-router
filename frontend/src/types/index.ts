// Mirrors the backend's controlled vocabularies (app/models/enums.py).
// Keeping these as string unions (not plain `string`) means the compiler
// catches typos in badge colors, filters, and dropdown options.

export type TicketCategory =
  | "Technical Issue"
  | "Billing"
  | "Account Access"
  | "Refund"
  | "Product Query"
  | "Security"
  | "Needs Clarification"
  | "Other"

export type TicketPriority = "High" | "Medium" | "Low"

export type AssignedTeam =
  | "Technical Support"
  | "Billing Operations"
  | "Identity and Access"
  | "Refunds Team"
  | "Product Support"
  | "Security Operations"
  | "General Support"

export type TicketStatus = "Open" | "Routed" | "In Progress" | "Needs Human Review" | "Resolved" | "Reopened"

export type TicketChannel = "Email" | "Chat" | "Phone" | "Portal"

export type CustomerTier = "Free" | "Standard" | "Premium" | "Enterprise"

export type SubscriptionStatus = "Active" | "Trial" | "Expired" | "Cancelled"

export type AccessStatus = "Active" | "Inactive" | "Suspended"

export type IncidentSeverity = "Critical" | "High" | "Medium" | "Low"

export type IncidentStatus = "Active" | "Monitoring" | "Resolved"

export type TicketQueueFilter =
  | "all"
  | "new_tickets"
  | "unassigned"
  | "high_priority"
  | "needs_human_review"
  | "active_incident"

export interface CustomerProduct {
  product_id: number
  product_name: string
  plan_name: string
  subscription_status: SubscriptionStatus
  access_status: AccessStatus
  expiry_date: string | null
}

export interface Customer {
  id: number
  name: string
  email: string
  tier: CustomerTier
  location: string
  preferred_language: string
  created_at: string
}

export interface Incident {
  id: number
  title: string
  description: string
  product_id: number
  product_name: string
  affected_location: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  started_at: string
  resolved_at: string | null
}

export interface CustomerDetail extends Customer {
  products: CustomerProduct[]
  active_incidents: Incident[]
}

export interface TicketListItem {
  id: number
  customer_id: number
  customer_name: string
  message_preview: string
  channel: TicketChannel
  category: TicketCategory | null
  priority: TicketPriority | null
  assigned_team: AssignedTeam | null
  status: TicketStatus
  confidence: number | null
  needs_human_review: boolean
  waiting_minutes: number
  created_at: string
}

export interface TicketRead {
  id: number
  customer_id: number
  customer_name: string
  message: string
  channel: TicketChannel
  category: TicketCategory | null
  priority: TicketPriority | null
  assigned_team: AssignedTeam | null
  reasoning: string | null
  confidence: number | null
  needs_human_review: boolean
  status: TicketStatus
  resolution: string | null
  created_at: string
  resolved_at: string | null
  human_verified: boolean
  routing_time_ms: number | null
}

export interface ContextUsed {
  customer_profile_used: boolean
  product_ids: number[]
  active_incident_ids: number[]
  similar_ticket_ids: number[]
  knowledge_document_ids: number[]
}

export interface RoutingResult {
  category: TicketCategory
  priority: TicketPriority
  assigned_team: AssignedTeam
  reasoning: string
  confidence: number
  needs_human_review: boolean
  clarification_questions: string[]
  context_used: ContextUsed
}

export interface TicketRouteRequest {
  customer_id: number
  message: string
  channel?: TicketChannel
  use_context?: boolean
  ticket_id?: number | null
  persist?: boolean
}

export interface TicketRouteResponse extends RoutingResult {
  ticket_id: number
}

export interface TicketFeedbackCreate {
  final_category?: TicketCategory | null
  final_priority?: TicketPriority | null
  final_assigned_team?: AssignedTeam | null
  feedback_note?: string | null
  send_for_human_review?: boolean
}

export interface TicketFeedbackRead {
  id: number
  ticket_id: number
  ai_category: TicketCategory | null
  ai_priority: TicketPriority | null
  ai_assigned_team: AssignedTeam | null
  final_category: TicketCategory | null
  final_priority: TicketPriority | null
  final_assigned_team: AssignedTeam | null
  feedback_note: string | null
  created_at: string
}

export interface MetricsSummary {
  total_routed_tickets: number
  human_review_percentage: number
  accepted_ai_decisions: number
  corrected_ai_decisions: number
  avg_ai_routing_time_seconds: number | null
  estimated_manual_routing_time_seconds: number
  estimated_time_saved_seconds: number | null
  manual_routing_time_is_estimated: boolean
}

export const TICKET_CATEGORIES: TicketCategory[] = [
  "Technical Issue",
  "Billing",
  "Account Access",
  "Refund",
  "Product Query",
  "Security",
  "Needs Clarification",
  "Other",
]

export const TICKET_PRIORITIES: TicketPriority[] = ["High", "Medium", "Low"]

export const ASSIGNED_TEAMS: AssignedTeam[] = [
  "Technical Support",
  "Billing Operations",
  "Identity and Access",
  "Refunds Team",
  "Product Support",
  "Security Operations",
  "General Support",
]

// --- Auth / roles -----------------------------------------------------------

export type UserRole = "Customer" | "Support Agent" | "Admin"

export type MessageType = "Customer Reply" | "Agent Reply" | "Internal Note"

export interface CurrentUser {
  id: number
  email: string
  role: UserRole
  is_active: boolean
  is_email_verified: boolean
  customer_id: number | null
  agent_display_name: string | null
  agent_team: AssignedTeam | null
}

export interface SignupRequest {
  email: string
  password: string
  name: string
  location?: string
  preferred_language?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface GenericMessage {
  message: string
}

export interface AcceptInvitationRequest {
  token: string
  password: string
  display_name: string
}

// --- Customer portal ----------------------------------------------------------

export interface MyProfile {
  email: string
  is_email_verified: boolean
  name: string
  tier: CustomerTier
  location: string
  preferred_language: string
  company: string | null
  phone: string | null
  contact_preferences: string | null
}

export interface MyProfileUpdate {
  name?: string
  location?: string
  preferred_language?: string
  company?: string
  phone?: string
  contact_preferences?: string
}

export interface MyTicket {
  id: number
  message: string
  channel: TicketChannel
  category: TicketCategory | null
  priority: TicketPriority | null
  assigned_team: AssignedTeam | null
  status: TicketStatus
  resolution: string | null
  created_at: string
  resolved_at: string | null
}

export interface MyTicketCreate {
  message: string
  channel?: TicketChannel
}

// --- Conversation / messages --------------------------------------------------

export interface TicketMessage {
  id: number
  ticket_id: number
  author_user_id: number | null
  author_label: string
  message_type: MessageType
  body: string
  created_at: string
}

export interface AgentRosterItem {
  id: number
  display_name: string
  team: AssignedTeam | null
}

export interface TicketAssignmentRead {
  id: number
  ticket_id: number
  assigned_agent_id: number | null
  assigned_agent_name: string | null
  assigned_team: AssignedTeam | null
  assigned_by: number | null
  assigned_at: string
}

// --- Persisted routing evidence -------------------------------------------------

export interface RoutingEvidenceRead extends RoutingResult {
  provider: string
  model_name: string | null
  rules_version: string
  created_at: string
}

// --- Admin ----------------------------------------------------------------------

export interface AgentUser {
  id: number
  email: string
  role: UserRole
  is_active: boolean
  is_email_verified: boolean
  display_name: string | null
  team: AssignedTeam | null
  last_login_at: string | null
  created_at: string
}

export interface AgentInviteRequest {
  email: string
  role: "Support Agent" | "Admin"
  team?: AssignedTeam | null
}

export interface AuditEventRead {
  id: number
  actor_user_id: number | null
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: number | null
  event_metadata: Record<string, unknown> | null
  created_at: string
}
