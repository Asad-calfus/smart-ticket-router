import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthCard, FormField } from "../../components/AuthCard"
import { Input, PasswordInput } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
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
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <FormField label="Location (optional)" htmlFor="location">
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </FormField>
        {error && (
          <div className="mb-3">
            <InlineFeedback tone="error" message={error} />
          </div>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating account..." : "Sign up"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
