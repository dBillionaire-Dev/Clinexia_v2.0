import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { CampaignsAdmin } from "@/components/admin/campaigns-admin"
import { isAdminAuthenticated } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Campaigns (admin)", robots: { index: false, follow: false } }

export default async function AdminCampaignsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  return <div className="mx-auto w-full max-w-5xl px-4 py-8"><CampaignsAdmin /></div>
}
