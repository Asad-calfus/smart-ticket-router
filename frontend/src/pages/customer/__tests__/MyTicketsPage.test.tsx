import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "../../../services/api"
import { MyTicketsPage } from "../MyTicketsPage"

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api")
  return { ...actual, api: { listMyTickets: vi.fn() } }
})

const sampleMyTicket = {
  id: 12,
  message: "My dashboard is not loading.",
  channel: "Portal" as const,
  category: "Technical Issue" as const,
  priority: "High" as const,
  assigned_team: "Technical Support" as const,
  status: "Routed" as const,
  resolution: null,
  created_at: "2026-01-01T00:00:00Z",
  resolved_at: null,
}

describe("MyTicketsPage", () => {
  beforeEach(() => {
    vi.mocked(api.listMyTickets).mockReset()
  })

  it("shows a loading state, then the customer's own tickets", async () => {
    vi.mocked(api.listMyTickets).mockResolvedValue([sampleMyTicket])
    render(
      <MemoryRouter>
        <MyTicketsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
    expect(await screen.findByText("My dashboard is not loading.")).toBeInTheDocument()
    expect(screen.getByText("High")).toBeInTheDocument()
  })

  it("shows an empty state when the customer has no tickets", async () => {
    vi.mocked(api.listMyTickets).mockResolvedValue([])
    render(
      <MemoryRouter>
        <MyTicketsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText("No tickets yet")).toBeInTheDocument()
  })

  it("shows an error state when tickets fail to load", async () => {
    vi.mocked(api.listMyTickets).mockRejectedValue(new Error("network down"))
    render(
      <MemoryRouter>
        <MyTicketsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText("Could not load your tickets.")).toBeInTheDocument()
  })
})
