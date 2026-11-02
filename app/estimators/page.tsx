import type { Metadata } from "next"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { AccessBadge } from "@/components/account/access-badge"
import { calculators } from "@/lib/calculators/registry"
import type { CalculatorGroup } from "@/lib/calculators/types"
import { CALCULATOR_CATEGORY_LABELS } from "@/lib/calculators/types"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Clinical Estimators",
  alternates: { canonical: "/estimators" },
}

// Estimators are grouped by clinical purpose rather than the raw data
// category, anthropometric/energy estimates (BSA, IBW, BMR, TDEE) read
// better as "Metabolic" here even though they live in the General/Oncology
// calculator domains.
const ESTIMATOR_GROUP_LABELS: Partial<Record<CalculatorGroup, string>> = {
  general: "Metabolic",
}

export default function EstimatorsPage() {
  const estimators = calculators.filter((c) => c.isEstimator)

  const groups = new Map<CalculatorGroup, typeof estimators>()
  for (const tool of estimators) {
    const existing = groups.get(tool.category) ?? []
    existing.push(tool)
    groups.set(tool.category, existing)
  }

  return (
    <PageContainer
      title="Estimators"
      description="Formula-based estimates (e.g. BSA, eGFR, BMR) & approximations, not measured values."
    >
      <div className="space-y-8">
        {Array.from(groups.entries()).map(([category, tools]) => (
          <section key={category}>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              {ESTIMATOR_GROUP_LABELS[category] ?? CALCULATOR_CATEGORY_LABELS[category]}
            </h2>
            <div className="grid gap-3">
              {tools.map((tool) => (
                <Link key={tool.id} href={`/calculators/${tool.category}/${tool.id}`}>
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader className="py-4">
                      <CardTitle className="text-base">{tool.name}<AccessBadge id={tool.id} category={tool.category} /></CardTitle>
                      <CardDescription className="mt-1">{tool.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  )
}
