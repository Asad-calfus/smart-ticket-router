import { useState } from "react"
import type { CustomerDetail, RoutingResult, TicketRead } from "../types"
import { PriorityBadge, StatusBadge } from "./Badge"
import { EmptyState, ErrorState, LoadingSkeleton } from "./StateViews"

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
  /** True when aiEvidence came from this session's live routing call (full evidence ids
   * available), false when it was reconstructed from a ticket routed in an earlier session
   * (evidence ids were never persisted, so only the decision itself can be shown). */
  aiEvidenceIsLive: boolean
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export function Customer360({
  customer,
  customerTickets,
  aiEvidence,
  aiEvidenceIsLive,
  isLoading,
  error,
  onRetry,
}: Customer360Props) {
  const [activeTab, setActiveTab] = useState<Tab>("profile")

  if (isLoading) {
    return (
      <div className="h-full border-l border-slate-200 bg-white">
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center border-l border-slate-200 bg-white p-4">
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex h-full items-center justify-center border-l border-slate-200 bg-white">
        <EmptyState title="No customer selected" description="Select a ticket to see the customer's 360 view." />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-800">{customer.name}</h2>
        <p className="text-xs text-slate-500">{customer.email}</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`rounded px-2 py-1 text-xs font-medium ${
              activeTab === tab.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 text-sm">
        {activeTab === "profile" && (
          <dl className="space-y-2">
            <Field label="Tier" value={customer.tier} />
            <Field label="Location" value={customer.location} />
            <Field label="Preferred language" value={customer.preferred_language} />
            <Field label="Customer since" value={new Date(customer.created_at).toLocaleDateString()} />
          </dl>
        )}

        {activeTab === "products" &&
          (customer.products.length === 0 ? (
            <EmptyState title="No products on file" />
          ) : (
            <ul className="space-y-2">
              {customer.products.map((product) => (
                <li key={product.product_id} className="rounded-md border border-slate-200 p-2.5">
                  <p className="text-sm font-medium text-slate-800">{product.product_name}</p>
                  <p className="text-xs text-slate-500">
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
          ))}

        {activeTab === "incidents" &&
          (customer.active_incidents.length === 0 ? (
            <EmptyState title="No active incidents" description="Nothing is currently affecting this customer." />
          ) : (
            <ul className="space-y-2">
              {customer.active_incidents.map((incident) => (
                <li key={incident.id} className="rounded-md border border-red-200 bg-red-50/40 p-2.5">
                  <p className="text-sm font-medium text-slate-800">{incident.title}</p>
                  <p className="text-xs text-slate-500">{incident.description}</p>
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {incident.severity} &middot; {incident.status} &middot; {incident.affected_location ?? "All regions"}
                  </p>
                </li>
              ))}
            </ul>
          ))}

        {activeTab === "history" &&
          (customerTickets.length === 0 ? (
            <EmptyState title="No previous tickets" />
          ) : (
            <ul className="space-y-2">
              {customerTickets.map((historicalTicket) => (
                <li key={historicalTicket.id} className="rounded-md border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">#{historicalTicket.id}</span>
                    <StatusBadge status={historicalTicket.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{historicalTicket.message}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <PriorityBadge priority={historicalTicket.priority} />
                    {historicalTicket.category && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {historicalTicket.category}
                      </span>
                    )}
                  </div>
                  {historicalTicket.resolution && (
                    <p className="mt-1 text-xs text-slate-500">Resolution: {historicalTicket.resolution}</p>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {activeTab === "evidence" &&
          (!aiEvidence ? (
            <EmptyState
              title="No AI evidence yet"
              description="Route this ticket to see the customer facts, incidents, and similar tickets used."
            />
          ) : (
            <div className="space-y-2 text-xs text-slate-600">
              {!aiEvidenceIsLive && (
                <p className="rounded bg-amber-50 p-2 text-amber-700 ring-1 ring-amber-200">
                  This ticket was routed in an earlier session — evidence ids weren't kept, only the decision
                  below. Re-route the ticket to see fresh evidence.
                </p>
              )}
              <p>Customer profile used: {aiEvidence.context_used.customer_profile_used ? "Yes" : "No"}</p>
              <p>Product ids referenced: {aiEvidence.context_used.product_ids.join(", ") || "none"}</p>
              <p>Matching incident ids: {aiEvidence.context_used.active_incident_ids.join(", ") || "none"}</p>
              <p>Similar ticket ids: {aiEvidence.context_used.similar_ticket_ids.join(", ") || "none"}</p>
              <p>Knowledge document ids: {aiEvidence.context_used.knowledge_document_ids.join(", ") || "none"}</p>
            </div>
          ))}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  const isGood = tone === "Active"
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        isGood ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {label}
    </span>
  )
}
