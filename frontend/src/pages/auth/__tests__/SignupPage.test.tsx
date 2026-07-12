import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { ApiError } from "../../../services/api"
import { SignupPage } from "../SignupPage"

const mockSignup = vi.fn()
const mockNavigate = vi.fn()

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ signup: mockSignup, user: null, isLoading: false, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

describe("SignupPage", () => {
  it("submits a new account and navigates home on success", async () => {
    mockSignup.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Full name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "SignupPass123")
    await user.click(screen.getByRole("button", { name: "Sign up" }))

    expect(mockSignup).toHaveBeenCalledWith("jane@example.com", "SignupPass123", "Jane Doe", undefined)
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"))
  })

  it("shows an error when signup fails (e.g. duplicate email)", async () => {
    mockSignup.mockRejectedValue(new ApiError("Could not create an account with these details.", 409))
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Full name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "SignupPass123")
    await user.click(screen.getByRole("button", { name: "Sign up" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not create an account with these details.")
  })
})
