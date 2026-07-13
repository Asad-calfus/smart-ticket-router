import { useEffect, useState } from "react"
import { ErrorState, LoadingSkeleton } from "../../components/StateViews"
import { Input } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
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
      <h2 className="text-lg font-semibold text-foreground">Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-3 rounded-lg border border-border bg-surface p-4">
        <label htmlFor="profile-name" className="block text-xs font-medium text-muted-foreground">
          Name
          <Input
            id="profile-name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="mt-1"
          />
        </label>
        <label htmlFor="profile-location" className="block text-xs font-medium text-muted-foreground">
          Location
          <Input
            id="profile-location"
            value={profile.location}
            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
            className="mt-1"
          />
        </label>
        <label htmlFor="profile-language" className="block text-xs font-medium text-muted-foreground">
          Preferred language
          <Input
            id="profile-language"
            value={profile.preferred_language}
            onChange={(e) => setProfile({ ...profile, preferred_language: e.target.value })}
            className="mt-1"
          />
        </label>
        <label htmlFor="profile-company" className="block text-xs font-medium text-muted-foreground">
          Company
          <Input
            id="profile-company"
            value={profile.company ?? ""}
            onChange={(e) => setProfile({ ...profile, company: e.target.value })}
            className="mt-1"
          />
        </label>
        <label htmlFor="profile-phone" className="block text-xs font-medium text-muted-foreground">
          Phone
          <Input
            id="profile-phone"
            value={profile.phone ?? ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="mt-1"
          />
        </label>
        <div className="text-xs text-muted-foreground">
          Plan: <span className="font-medium text-foreground">{profile.tier}</span> (managed by support, not editable
          here)
        </div>

        {error && <InlineFeedback tone="error" message={error} />}
        {savedMessage && <InlineFeedback tone="success" message={savedMessage} />}

        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </div>
  )
}
