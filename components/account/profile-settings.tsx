"use client"

import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { confirmDialog } from "@/components/ui/app-dialogs"
import { PasswordInput } from "./password-input"
import { UserAvatar } from "./user-avatar"
import { api } from "@/lib/billing/client"
import { notifySessionChanged } from "@/lib/billing/use-account-session"
import { preparePhoto } from "@/lib/avatar-client"
import { BACKGROUND, rolesFor } from "@/lib/feedback/questions"

export interface ProfileData { fullName: string; accountType: "individual" | "enterprise"; background: string | null; role: string | null }
const field = "w-full rounded-md border bg-background px-3 py-2 text-sm"

/** The account page's "your photo, your details, your password". */
export function ProfileSettings({ email, avatarUrl, avatarSource, profile, onChanged }: { email: string; avatarUrl?: string; avatarSource?: "upload" | "google"; profile: ProfileData | null; onChanged: () => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState("")
  const [d, setD] = useState({ fullName: profile?.fullName ?? "", background: profile?.background ?? "", role: profile?.role ?? "" })
  const [detailsBusy, setDetailsBusy] = useState(false)
  const [detailsMsg, setDetailsMsg] = useState("")
  const [pw, setPw] = useState({ current: "", next: "", again: "" })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState("")
  const initial = (profile?.fullName || email).trim().charAt(0).toUpperCase()

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setPhotoBusy(true); setPhotoMsg("")
    const prepared = await preparePhoto(f)
    if (!prepared.ok) { setPhotoBusy(false); return setPhotoMsg(prepared.error) }
    const r = await api("/api/account/avatar", { image: prepared.image })
    setPhotoBusy(false)
    if (r.ok) { setPhotoMsg("Photo saved."); notifySessionChanged(); onChanged() } else setPhotoMsg(r.error)
  }
  async function removePhoto() {
    if (!(await confirmDialog({ title: "Remove your photo?", description: avatarSource === "upload" ? "Your initial (or your Google photo, if you signed in with Google) will show instead." : "Your initial will show instead.", confirmLabel: "Remove" }))) return
    setPhotoBusy(true); setPhotoMsg("")
    const r = await api("/api/account/avatar", { remove: true })
    setPhotoBusy(false)
    if (r.ok) { setPhotoMsg("Photo removed."); notifySessionChanged(); onChanged() } else setPhotoMsg(r.error)
  }
  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    setDetailsBusy(true); setDetailsMsg("")
    const r = await api("/api/account/profile", d)
    setDetailsBusy(false)
    if (r.ok) { setDetailsMsg("Saved."); onChanged() } else setDetailsMsg(r.error)
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pw.next !== pw.again) return setPwError("The two new passwords do not match.")
    setPwBusy(true); setPwError("")
    const r = await api("/api/account/password", { current: pw.current, next: pw.next })
    if (r.ok) { notifySessionChanged(); window.location.href = "/login?changed=1"; return }
    setPwBusy(false); setPwError(r.error)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Your photo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar url={avatarUrl} initial={initial} size={72} />
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <input ref={file} type="file" accept="image/*" className="hidden" onChange={choose} />
              <Button type="button" variant="outline" disabled={photoBusy} onClick={() => file.current?.click()}>{photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : avatarUrl ? "Change photo" : "Upload photo"}</Button>
              {avatarUrl && avatarSource === "upload" && <button type="button" className="underline" disabled={photoBusy} onClick={removePhoto}>Remove photo</button>}
            </div>
            <p className="text-xs text-muted-foreground">{avatarSource === "google" ? "Showing your Google photo. Upload one to use a different picture. " : ""}JPEG or PNG, up to 2 MB.</p>
            {photoMsg && <p role="status" className="text-xs">{photoMsg}</p>}
          </div>
        </div>
      </section>

      {profile && (
        <form onSubmit={saveDetails} className="rounded-lg border p-4 space-y-3">
          <h2 className="font-medium">Your details</h2>
          <label className="block text-sm"><span className="mb-1 block font-medium">Full name</span><Input value={d.fullName} onChange={(e) => setD({ ...d, fullName: e.target.value })} autoComplete="name" required /></label>
          <p className="text-xs text-muted-foreground">Email: {email}. This is what you sign in with, so it cannot be changed here.</p>
          {profile.accountType === "individual" && (
            <>
              <label className="block text-sm"><span className="mb-1 block font-medium">Do you work in healthcare?</span>
                <select className={field} value={d.background} onChange={(e) => setD({ ...d, background: e.target.value, role: "" })} required><option value="">Choose…</option>{BACKGROUND.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></label>
              {d.background && <label className="block text-sm"><span className="mb-1 block font-medium">What describes you best?</span>
                <select className={field} value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })} required><option value="">Choose…</option>{rolesFor(d.background).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
                <span className="mt-1 block text-xs text-muted-foreground">This is for your profile only. It never changes what you can access.</span></label>}
            </>
          )}
          <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={detailsBusy}>{detailsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save details"}</Button>{detailsMsg && <span role="status" className="text-sm">{detailsMsg}</span>}</div>
        </form>
      )}

      <form onSubmit={changePassword} className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Change your password</h2>
        <label className="block text-sm"><span className="mb-1 block font-medium">Current password</span><PasswordInput value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">New password</span><PasswordInput value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={10} required /><span className="mt-1 block text-xs text-muted-foreground">At least 10 characters.</span></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Repeat the new password</span><PasswordInput value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} autoComplete="new-password" minLength={10} required /></label>
        <p className="text-xs text-muted-foreground">You will be signed out everywhere and sign in again with the new password. Signed up another way and never set a password? Use “Forgot password?” on the sign-in page.</p>
        {pwError && <p role="alert" className="text-sm text-destructive">{pwError}</p>}
        <Button type="submit" disabled={pwBusy}>{pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}</Button>
      </form>
    </div>
  )
}
