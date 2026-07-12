import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "../../../services/api"
import { AgentsPage } from "../AgentsPage"

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api")
  return {
    ...actual,
    api: {
      listAgents: vi.fn(),
      inviteAgent: vi.fn(),
      activateAgent: vi.fn(),
      deactivateAgent: vi.fn(),
    },
  }
})

const sampleAgent = {
  id: 4,
  email: "agent@example.com",
  role: "Support Agent" as const,
  is_active: true,
  is_email_verified: true,
  display_name: "Demo Agent",
  team: "General Support" as const,
  last_login_at: null,
  created_at: "2026-01-01T00:00:00Z",
}

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.mocked(api.listAgents).mockReset().mockResolvedValue([sampleAgent])
    vi.mocked(api.inviteAgent).mockReset()
    vi.mocked(api.deactivateAgent).mockReset()
  })

  it("lists existing agents", async () => {
    render(<AgentsPage />)
    expect(await screen.findByText("agent@example.com")).toBeInTheDocument()
    expect(screen.getByText("Demo Agent")).toBeInTheDocument()
  })

  it("sends an invitation and shows the confirmation message", async () => {
    vi.mocked(api.inviteAgent).mockResolvedValue({ message: "Invitation sent." })
    const user = userEvent.setup()
    render(<AgentsPage />)
    await screen.findByText("agent@example.com")

    await user.type(screen.getByLabelText("Email"), "newagent@example.com")
    await user.click(screen.getByRole("button", { name: "Invite" }))

    expect(api.inviteAgent).toHaveBeenCalledWith(
      expect.objectContaining({ email: "newagent@example.com", role: "Support Agent" }),
    )
    expect(await screen.findByText("Invitation sent.")).toBeInTheDocument()
  })

  it("can deactivate an active agent", async () => {
    vi.mocked(api.deactivateAgent).mockResolvedValue({ ...sampleAgent, is_active: false })
    const user = userEvent.setup()
    render(<AgentsPage />)
    await screen.findByText("agent@example.com")

    await user.click(screen.getByRole("button", { name: "Deactivate" }))

    expect(api.deactivateAgent).toHaveBeenCalledWith(4)
    expect(await screen.findByText("Deactivated")).toBeInTheDocument()
  })
})
