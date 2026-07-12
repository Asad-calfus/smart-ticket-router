import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { ProtectedRoute } from "../ProtectedRoute"

const mockUseAuth = vi.fn()

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

function renderProtected(allowedRoles?: ("Customer" | "Support Agent" | "Admin")[]) {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute", () => {
  it("shows a loading state while auth status is being determined", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    renderProtected()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("redirects to /login when there is no authenticated user", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })
    renderProtected()
    expect(screen.getByText("Login Page")).toBeInTheDocument()
  })

  it("redirects home when the user's role isn't in allowedRoles", () => {
    mockUseAuth.mockReturnValue({ user: { role: "Customer" }, isLoading: false })
    renderProtected(["Admin"])
    expect(screen.getByText("Home Page")).toBeInTheDocument()
  })

  it("renders the protected content when authenticated and authorized", () => {
    mockUseAuth.mockReturnValue({ user: { role: "Admin" }, isLoading: false })
    renderProtected(["Admin"])
    expect(screen.getByText("Protected Content")).toBeInTheDocument()
  })

  it("renders protected content for any authenticated user when no roles are specified", () => {
    mockUseAuth.mockReturnValue({ user: { role: "Customer" }, isLoading: false })
    renderProtected()
    expect(screen.getByText("Protected Content")).toBeInTheDocument()
  })
})
