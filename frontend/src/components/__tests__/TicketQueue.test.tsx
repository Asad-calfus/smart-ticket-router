import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { sampleTicketListItem } from "../../test/fixtures"
import { TicketQueue } from "../TicketQueue"

describe("TicketQueue", () => {
  it("shows a loading skeleton while tickets are loading", () => {
    render(
      <TicketQueue
        tickets={[]}
        filter="all"
        onFilterChange={vi.fn()}
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        isLoading
        error={null}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })

  it("renders the loaded ticket list", () => {
    render(
      <TicketQueue
        tickets={[sampleTicketListItem]}
        filter="all"
        onFilterChange={vi.fn()}
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText("Premium Dashboard is not opening.")).toBeInTheDocument()
    expect(screen.getByText("Ananya Sharma")).toBeInTheDocument()
  })

  it("renders an error state with a retry button", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <TicketQueue
        tickets={[]}
        filter="all"
        onFilterChange={vi.fn()}
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        isLoading={false}
        error="Could not load tickets."
        onRetry={onRetry}
      />,
    )
    expect(screen.getByText("Could not load tickets.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("shows an empty state when there are no tickets for the filter", () => {
    render(
      <TicketQueue
        tickets={[]}
        filter="high_priority"
        onFilterChange={vi.fn()}
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText("No tickets match this filter")).toBeInTheDocument()
  })

  it("calls onFilterChange when a filter button is clicked", async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(
      <TicketQueue
        tickets={[]}
        filter="all"
        onFilterChange={onFilterChange}
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: "High Priority" }))
    expect(onFilterChange).toHaveBeenCalledWith("high_priority")
  })

  it("calls onSelectTicket when a ticket row is clicked", async () => {
    const user = userEvent.setup()
    const onSelectTicket = vi.fn()
    render(
      <TicketQueue
        tickets={[sampleTicketListItem]}
        filter="all"
        onFilterChange={vi.fn()}
        selectedTicketId={null}
        onSelectTicket={onSelectTicket}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )
    await user.click(screen.getByText("Premium Dashboard is not opening."))
    expect(onSelectTicket).toHaveBeenCalledWith(1)
  })

  it("searches tickets by customer, message or ticket id", async () => {
    const user = userEvent.setup()
    render(
      <TicketQueue
        tickets={[sampleTicketListItem]}
        filter="all"
        onFilterChange={vi.fn()}
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )

    await user.type(screen.getByRole("searchbox", { name: "Search tickets" }), "no match")
    expect(screen.getByText("No tickets match your search")).toBeInTheDocument()
    await user.clear(screen.getByRole("searchbox", { name: "Search tickets" }))
    await user.type(screen.getByRole("searchbox", { name: "Search tickets" }), "Ananya")
    expect(screen.getByText("Premium Dashboard is not opening.")).toBeInTheDocument()
  })

  it("offers a manual refresh button", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <TicketQueue
        tickets={[]}
        filter="all"
        onFilterChange={vi.fn()}
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={onRetry}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Refresh" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
