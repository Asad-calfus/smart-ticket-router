import { useState } from "react"
import type { CustomerDetail, RoutingResult, TicketRead } from "../types"
import { PriorityBadge, StatusBadge } from "./Badge"
import { EmptyState, ErrorState, LoadingSkeleton } from "./StateViews"
import { SectionHeader } from "./ui/Tabs"

type Tab = "profile" | "products" | "incidents" | "history" | "evidence"

const TABS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "products", label: "Products" },
  { value: "incidents", label: "Incidents" },
  { value: "history", label: "History" },
  { value: "evidence", label: "AI Evidence" },
]

interface Customer360Props {
  customer: CustomerDetail | null
  customerTickets: TicketRead[]
  aiEvidence: RoutingResult | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export function Customer360({ customer, customerTickets, aiEvidence, isLoading, error, onRetry }: Customer360Props) {
  const [activeTab, setActiveTab] = useState<Tab>("profile")

  if (isLoading) {
    return (
      <div className="h-full bg-surface">
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-4">
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <EmptyState title="No customer selected" description="Select a ticket to see the customer's 360 view." />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">{customer.name}</h2>
        <p className="text-xs text-muted-foreground">{customer.email}</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
              activeTab === tab.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 text-sm">
        {activeTab === "profile" && (
          <div className="space-y-4">
            <div>
              <SectionHeader title="Identity" />
              <dl className="mt-2 space-y-2">
                <Field label="Tier" value={customer.tier} />
                <Field label="Customer since" value={new Date(customer.created_at).toLocaleDateString()} />
              </dl>
            </div>
            <div className="border-t border-border pt-4">
              <SectionHeader title="Location & Language" />
              <dl className="mt-2 space-y-2">
                <Field label="Location" value={customer.location} />
                <Field label="Preferred language" value={customer.preferred_language} />
              </dl>
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div>
            <SectionHeader title="Products & Access" />
            {customer.products.length === 0 ? (
              <div className="mt-2">
                <EmptyState title="No products on file" />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {customer.products.map((product) => (
                  <li key={product.product_id} className="py-3 first:pt-0">
                    <p className="text-sm font-medium text-foreground">{product.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Plan: {product.plan_name} &middot; Expires:{" "}
                      {product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : "n/a"}
                    </p>
                    <div className="mt-1 flex gap-1.5">
                      <StatusPill label={`Subscription: ${product.subscription_status}`} tone={product.subscription_status} />
                      <StatusPill label={`Access: ${product.access_status}`} tone={product.access_status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "incidents" && (
          <div>
            <SectionHeader title="Active Incidents" />
            {customer.active_incidents.length === 0 ? (
              <div className="mt-2">
                <EmptyState title="No active incidents" description="Nothing is currently affecting this customer." />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {customer.active_incidents.map((incident) => (
                  <li key={incident.id} className="border-l-2 border-review-border py-3 pl-3 first:pt-0">
                    <p className="text-sm font-medium text-foreground">{incident.title}</p>
                    <p className="text-xs text-muted-foreground">{incident.description}</p>
                    <p className="mt-1 text-xs font-medium text-review">
                      {incident.severity} &middot; {incident.status} &middot; {incident.affected_location ?? "All regions"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <SectionHeader title="Ticket History" />
            {customerTickets.length === 0 ? (
              <div className="mt-2">
                <EmptyState title="No previous tickets" />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {customerTickets.map((historicalTicket) => (
                  <li key={historicalTicket.id} className="py-3 first:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">#{historicalTicket.id}</span>
                      <StatusBadge status={historicalTicket.status} />
                    </div>
                    <p className="mt-1 text-sm text-foreground">{historicalTicket.message}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <PriorityBadge priority={historicalTicket.priority} />
                      {historicalTicket.category && (
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                          {historicalTicket.category}
                        </span>
                      )}
                    </div>
                    {historicalTicket.resolution && (
                      <p className="mt-1 text-xs text-muted-foreground">Resolution: {historicalTicket.resolution}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "evidence" && (
          <div>
            <SectionHeader title="AI Evidence" />
            {!aiEvidence ? (
              <div className="mt-2">
                <EmptyState
                  title="No AI evidence yet"
                  description="Route this ticket to see the customer facts, incidents, and similar tickets used."
                />
              </div>
            ) : (
              <dl className="mt-2 space-y-2">
                <Field label="Customer profile used" value={aiEvidence.context_used.customer_profile_used ? "Yes" : "No"} />
                <Field label="Product ids referenced" value={aiEvidence.context_used.product_ids.join(", ") || "none"} />
                <Field label="Matching incident ids" value={aiEvidence.context_used.active_incident_ids.join(", ") || "none"} />
                <Field label="Similar ticket ids" value={aiEvidence.context_used.similar_ticket_ids.join(", ") || "none"} />
                <Field
                  label="Knowledge document ids"
                  value={aiEvidence.context_used.knowledge_document_ids.join(", ") || "none"}
                />
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  const isGood = tone === "Active"
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${isGood ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>
      {label}
    </span>
  )
}
