import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SetupCheck } from "@/components/admin/setup-check"
import { isAdminAuthenticated } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Setup check (admin)", robots: { index: false, follow: false } }

export default async function AdminSetupPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  return <div className="mx-auto w-full max-w-3xl px-4 py-8"><SetupCheck /></div>
}
