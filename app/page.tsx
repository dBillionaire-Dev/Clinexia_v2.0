import type { Metadata } from "next"
import HomePage from "@/components/home-page-client"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function Page() {
  return <HomePage />
}
