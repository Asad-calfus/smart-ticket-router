import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthCard, FormField, inputClassName, primaryButtonClassName } from "../../components/AuthCard"
import { useAuth } from "../../contexts/AuthContext"
import { ApiError } from "../../services/api"

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [location, setLocation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await signup(email, password, name, location || undefined)
      navigate("/")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create an account.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="For customers only — agents are invited by an admin.">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Full name" htmlFor="name">
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClassName}
          />
        </FormField>
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Location (optional)" htmlFor="location">
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClassName}
          />
        </FormField>
        {error && (
          <p className="mb-3 text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClassName}>
          {isSubmitting ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-xs text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-slate-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
