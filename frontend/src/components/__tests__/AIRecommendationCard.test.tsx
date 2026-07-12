import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { sampleRoutingResult } from "../../test/fixtures"
import { AIRecommendationCard } from "../AIRecommendationCard"

describe("AIRecommendationCard", () => {
  it("renders the AI recommendation: category, priority, team, reasoning and evidence", () => {
    render(
      <AIRecommendationCard
        result={sampleRoutingResult}
        onAccept={vi.fn()}
        onEdit={vi.fn()}
        onSendForHumanReview={vi.fn()}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText("Account Access")).toBeInTheDocument()
    expect(screen.getByText("High")).toBeInTheDocument()
    expect(screen.getByText("Identity and Access")).toBeInTheDocument()
    expect(screen.getByText(sampleRoutingResult.reasoning)).toBeInTheDocument()
    expect(screen.getByText("92% confidence")).toBeInTheDocument()
  })

  it("calls onAccept when Accept Routing is clicked", async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    render(
      <AIRecommendationCard
        result={sampleRoutingResult}
        onAccept={onAccept}
        onEdit={vi.fn()}
        onSendForHumanReview={vi.fn()}
        isSubmitting={false}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Accept Routing" }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it("lets the agent edit and save a corrected category/priority/team", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <AIRecommendationCard
        result={sampleRoutingResult}
        onAccept={vi.fn()}
        onEdit={onEdit}
        onSendForHumanReview={vi.fn()}
        isSubmitting={false}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.selectOptions(screen.getByLabelText("Priority"), "Low")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ category: "Account Access", priority: "Low", assignedTeam: "Identity and Access" }),
    )
  })

  it("shows clarification questions when present", () => {
    render(
      <AIRecommendationCard
        result={{ ...sampleRoutingResult, category: "Needs Clarification", clarification_questions: ["Which product is affected?"] }}
        onAccept={vi.fn()}
        onEdit={vi.fn()}
        onSendForHumanReview={vi.fn()}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText("Which product is affected?")).toBeInTheDocument()
  })
})
