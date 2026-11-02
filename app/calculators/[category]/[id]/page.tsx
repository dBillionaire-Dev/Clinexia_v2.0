import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { calculators, getCalculatorById } from "@/lib/calculators/registry"
import { CalculatorRunner } from "@/components/calculators/calculator-runner"

export const dynamicParams = false

export function generateStaticParams() {
  return calculators.map((c) => ({ category: c.category, id: c.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; id: string }> }): Promise<Metadata> {
  const { category, id } = await params
  const definition = getCalculatorById(id)
  if (!definition || definition.category !== category) return {}
  const title = `${definition.name} Calculator`
  const description = definition.description
  return {
    title,
    description,
    keywords: [definition.name, `${definition.name} calculator`, `${definition.name} clinical calculator`, ...(definition.keywords ?? []), "Clinexia"],
    alternates: { canonical: `/calculators/${category}/${id}` },
    openGraph: { title, description, url: `/calculators/${category}/${id}`, type: "website", images: [{ url: "/og-image.png", alt: `Clinexia ${definition.name} calculator` }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
  }
}

export default async function CalculatorPage({
    params,
  }: {
    params: Promise<{ category: string; id: string }>
  }) {
    const { category, id } = await params

    const definition = getCalculatorById(id)

    if (!definition || definition.category !== category) {
      notFound()
    }

  return (
    <PageContainer>
      <h1 className="sr-only">{definition.name}</h1>
      <CalculatorRunner calculatorId={definition.id} />
    </PageContainer>
  )
}
