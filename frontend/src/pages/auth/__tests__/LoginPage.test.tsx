import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { ApiError } from "../../../services/api"
import { LoginPage } from "../LoginPage"

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, user: null, isLoading: false, signup: vi.fn(), logout: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

describe("LoginPage", () => {
  it("submits credentials and navigates home on success", async () => {
    mockLogin.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Email"), "agent@example.com")
    await user.type(screen.getByLabelText("Password"), "DemoPass123!")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(mockLogin).toHaveBeenCalledWith("agent@example.com", "DemoPass123!")
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"))
  })

  it("shows a generic error message when login fails", async () => {
    mockLogin.mockRejectedValue(new ApiError("Incorrect email or password.", 401))
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Email"), "agent@example.com")
    await user.type(screen.getByLabelText("Password"), "WrongPassword")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.")
  })
})
