import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "../../services/api"
import { sampleCustomer, sampleCustomerDetail, sampleTicketListItem, sampleTicketRead } from "../../test/fixtures"
import { WorkspacePage } from "../WorkspacePage"

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api")
  return {
    ...actual,
    api: {
      getCustomers: vi.fn(),
      getCustomer: vi.fn(),
      getCustomerTickets: vi.fn(),
      getTickets: vi.fn(),
      getTicket: vi.fn(),
      routeTicket: vi.fn(),
      submitFeedback: vi.fn(),
      resolveTicket: vi.fn(),
      getActiveIncidents: vi.fn(),
      getMetricsSummary: vi.fn(),
      getAgentRoster: vi.fn(),
      listTicketMessages: vi.fn(),
      getTicketEvidence: vi.fn(),
      addTicketMessage: vi.fn(),
      assignTicket: vi.fn(),
    },
  }
})

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "agent@example.com", role: "Support Agent", agent_display_name: "Demo Agent", agent_team: "General Support" },
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}))

describe("WorkspacePage", () => {
  beforeEach(() => {
    vi.mocked(api.getCustomers).mockResolvedValue([sampleCustomer])
    vi.mocked(api.getTickets).mockResolvedValue([sampleTicketListItem])
    vi.mocked(api.getTicket).mockResolvedValue(sampleTicketRead)
    vi.mocked(api.getCustomer).mockResolvedValue(sampleCustomerDetail)
    vi.mocked(api.getCustomerTickets).mockResolvedValue([])
    vi.mocked(api.getAgentRoster).mockResolvedValue([])
    vi.mocked(api.listTicketMessages).mockResolvedValue([])
    vi.mocked(api.getTicketEvidence).mockRejectedValue(new Error("not routed"))
  })

  it("loads and displays the ticket queue and, once a ticket is selected, the customer 360 view", async () => {
    render(<WorkspacePage />)

    expect(await screen.findByText("Premium Dashboard is not opening.")).toBeInTheDocument()
    expect(api.getTickets).toHaveBeenCalledWith("all")

    const user = userEvent.setup()
    await user.click(screen.getByText("Premium Dashboard is not opening."))

    expect(await screen.findByRole("heading", { name: "Ananya Sharma" })).toBeInTheDocument()
    expect(api.getCustomer).toHaveBeenCalledWith(1)
  })

  it("renders an error/fallback state when the ticket list fails to load", async () => {
    vi.mocked(api.getTickets).mockRejectedValue(new Error("network down"))
    render(<WorkspacePage />)

    expect(await screen.findByText("Could not load tickets.")).toBeInTheDocument()
  })

  it("re-fetches the ticket queue when a filter is clicked", async () => {
    const user = userEvent.setup()
    render(<WorkspacePage />)
    await screen.findByText("Premium Dashboard is not opening.")

    await user.click(screen.getByRole("button", { name: "High Priority" }))

    expect(api.getTickets).toHaveBeenCalledWith("high_priority")
  })
})
