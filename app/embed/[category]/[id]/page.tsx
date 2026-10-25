import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getCalculatorById } from "@/lib/calculators/registry"
import { EmbedCalculator } from "@/components/embed/embed-calculator"
import { getEmbedOrigins, isAllowedOrigin, normaliseOrigin } from "@/lib/integration/embed-origins"
import { parsePrefill } from "@/lib/integration/prefill"

// Per-request: the allowlist and the parent's Referer are read here. Nothing about the inputs is read on the server.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Clinexia calculator (embedded)",
  robots: { index: false, follow: false },
}

function refererOrigin(referer: string | null): string | null {
  if (!referer) return null
  try {
    return normaliseOrigin(new URL(referer).origin)
  } catch {
    return null
  }
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { category, id } = await params
  const query = await searchParams
  const definition = getCalculatorById(id)
  if (!definition || definition.category !== category) notFound()

  // Only the view options are used on the server (theme, postMessage, parentOrigin). Input values are parsed in the browser.
  const view = parsePrefill(definition, query)

  // The parent origin handed to the browser must be on the allowlist; otherwise postMessage stays off.
  let parentOrigin: string | null = null
  if (view.postMessage) {
    const allowed = await getEmbedOrigins()
    const fromReferer = refererOrigin((await headers()).get("referer"))
    parentOrigin = [view.parentOrigin, fromReferer].find((o) => isAllowedOrigin(o, allowed)) ?? null
  }

  return (
    <>
      {view.theme ? (
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.${view.theme === "dark" ? "add" : "remove"}("dark")` }} />
      ) : null}
      <h1 className="sr-only">{definition.name}</h1>
      <EmbedCalculator calculatorId={definition.id} embed={{ postMessage: view.postMessage, parentOrigin }} />
    </>
  )
}
