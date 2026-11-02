import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { conversionCategories, getConversionCategory } from "@/lib/conversions/registry"
import { ConversionRunner } from "@/components/conversions/conversion-runner"

export const dynamicParams = false

export function generateStaticParams() {
  return conversionCategories.map((c) => ({ category: c.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: categoryParam } = await params
  const category = getConversionCategory(categoryParam)
  if (!category) return {}
  const title = `${category.name} Converter`
  const description = `Convert between ${category.units.map((u) => u.symbol).join(", ")} with the Clinexia ${category.name.toLowerCase()} converter. Free, works offline.`
  return {
    title,
    description,
    alternates: { canonical: `/conversions/${category.id}` },
    openGraph: { title, description, url: `/conversions/${category.id}`, type: "website", images: [{ url: "/og-image.png", alt: `Clinexia ${category.name} converter` }] },
  }
}

export default async function ConversionCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: categoryParam } = await params

  const category = getConversionCategory(categoryParam)

  if (!category) {
    notFound()
  }

  return (
    <PageContainer>
      <h1 className="sr-only">{category.name} Conversion</h1>
      <ConversionRunner category={category} />
    </PageContainer>
  )
}
