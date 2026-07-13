import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, ApiError } from "../../services/api"
import { sampleCustomer } from "../../test/fixtures"
import { NewTicketForm } from "../NewTicketForm"

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api")
  return { ...actual, api: { routeTicket: vi.fn() } }
})

describe("NewTicketForm", () => {
  beforeEach(() => {
    vi.mocked(api.routeTicket).mockReset()
  })

  it("submits a new ticket message and reports the routed ticket id", async () => {
    const user = userEvent.setup()
    vi.mocked(api.routeTicket).mockResolvedValue({
      ticket_id: 42,
      category: "Technical Issue",
      priority: "Medium",
      assigned_team: "Technical Support",
      reasoning: "test",
      confidence: 0.8,
      needs_human_review: false,
      clarification_questions: [],
      context_used: {
        customer_profile_used: true,
        product_ids: [],
        active_incident_ids: [],
        similar_ticket_ids: [],
        knowledge_document_ids: [],
      },
    })
    const onRouted = vi.fn()

    render(<NewTicketForm customers={[sampleCustomer]} onRouted={onRouted} />)

    await user.click(screen.getByRole("button", { name: "New Ticket" }))
    await user.selectOptions(screen.getByRole("combobox", { name: "Customer" }), "1")
    await user.type(screen.getByPlaceholderText("Describe the issue..."), "Dashboard is not loading.")
    await user.click(screen.getByRole("button", { name: "Submit & Route" }))

    expect(api.routeTicket).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 1, message: "Dashboard is not loading." }),
    )
    await vi.waitFor(() => expect(onRouted).toHaveBeenCalledWith(42))
  })

  it("shows an error message when submitting fails", async () => {
    const user = userEvent.setup()
    vi.mocked(api.routeTicket).mockRejectedValue(new ApiError("Customer 1 not found.", 404))

    render(<NewTicketForm customers={[sampleCustomer]} onRouted={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "New Ticket" }))
    await user.selectOptions(screen.getByRole("combobox", { name: "Customer" }), "1")
    await user.type(screen.getByPlaceholderText("Describe the issue..."), "Dashboard is not loading.")
    await user.click(screen.getByRole("button", { name: "Submit & Route" }))

    await screen.findByText("Customer 1 not found.")
  })
})
