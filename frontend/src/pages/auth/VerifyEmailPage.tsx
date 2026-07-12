import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AuthCard } from "../../components/AuthCard"
import { api, ApiError } from "../../services/api"

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("This link is missing its verification token.")
      return
    }
    api
      .verifyEmail(token)
      .then((response) => {
        setStatus("success")
        setMessage(response.message)
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err instanceof ApiError ? err.message : "Could not verify this email.")
      })
  }, [token])

  return (
    <AuthCard title="Email verification">
      {status === "loading" && <p className="text-sm text-slate-500">Verifying...</p>}
      {status !== "loading" && (
        <p className={`text-sm ${status === "success" ? "text-emerald-700" : "text-red-600"}`}>{message}</p>
      )}
      <Link to="/login" className="mt-4 inline-block text-xs text-slate-600 hover:underline">
        Back to login
      </Link>
    </AuthCard>
  )
}
