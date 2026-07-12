import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthCard, FormField, inputClassName, primaryButtonClassName } from "../../components/AuthCard"
import { useAuth } from "../../contexts/AuthContext"
import { ApiError } from "../../services/api"

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate("/")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard title="Log in" subtitle="Smart Support Ticket Router">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClassName}
          />
        </FormField>
        {error && (
          <p className="mb-3 text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClassName}>
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>
      <div className="mt-4 flex flex-col gap-1 text-xs text-slate-500">
        <Link to="/forgot-password" className="hover:underline">
          Forgot password?
        </Link>
        <span>
          New customer?{" "}
          <Link to="/signup" className="font-medium text-slate-700 hover:underline">
            Sign up
          </Link>
        </span>
      </div>
    </AuthCard>
  )
}
