"use client"
// clinexia-upgrade:phase6
import { useRouter } from "next/navigation"
import { EmergencyMode } from "@/components/emergency/emergency-mode"

export default function EmergencyPage() {
  const router = useRouter()
  return <EmergencyMode onExit={() => (window.history.length > 1 ? router.back() : router.push("/"))} />
}
