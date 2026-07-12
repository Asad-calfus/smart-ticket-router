import { useEffect, useState } from "react"
import { ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { api, ApiError } from "../../services/api"
import type { MyProfile } from "../../types"

export function ProfilePage() {
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  function load() {
    setIsLoading(true)
    setError(null)
    api
      .getMyProfile()
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your profile."))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!profile) return
    setIsSaving(true)
    setSavedMessage(null)
    setError(null)
    try {
      const updated = await api.updateMyProfile({
        name: profile.name,
        location: profile.location,
        preferred_language: profile.preferred_language,
        company: profile.company ?? undefined,
        phone: profile.phone ?? undefined,
        contact_preferences: profile.contact_preferences ?? undefined,
      })
      setProfile(updated)
      setSavedMessage("Profile updated.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={5} />
  if (error && !profile) return <ErrorState message={error} onRetry={load} />
  if (!profile) return null

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800">Profile</h2>
      <p className="mt-1 text-sm text-slate-500">{profile.email}</p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-xs font-medium text-slate-600">
          Name
          <input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Location
          <input
            value={profile.location}
            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Preferred language
          <input
            value={profile.preferred_language}
            onChange={(e) => setProfile({ ...profile, preferred_language: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Company
          <input
            value={profile.company ?? ""}
            onChange={(e) => setProfile({ ...profile, company: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Phone
          <input
            value={profile.phone ?? ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="text-xs text-slate-400">
          Plan: <span className="font-medium text-slate-600">{profile.tier}</span> (managed by support, not editable
          here)
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        {savedMessage && <p className="text-xs font-medium text-emerald-600">{savedMessage}</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  )
}
