import type { Metadata } from "next"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Droplets, FlaskConical, Percent, Layers, Bug, Waves } from "lucide-react"

export const metadata: Metadata = {
  title: "Laboratory Tools",
  alternates: { canonical: "/lab-tools" },
}

const labTools = [
  { href: "/lab-tools/dilution", label: "C1V1 = C2V2 Dilution", description: "Solve for concentration or volume", icon: Droplets },
  { href: "/lab-tools/serial-dilution", label: "Serial Dilution", description: "Concentration at every step of a dilution series", icon: Layers },
  { href: "/lab-tools/percentage-solution", label: "Percentage Solution", description: "% w/v, % v/v, % w/w conversions", icon: Percent },
  { href: "/calculators/lab-solutions/molarity", label: "Molarity Calculator", description: "Mass, molecular weight, volume  to  M", icon: FlaskConical },
  { href: "/calculators/lab-solutions/normality", label: "Normality Calculator", description: "Mass, equivalent weight, volume  to  N", icon: FlaskConical },
  { href: "/lab-tools/microbiology", label: "Microbiology", description: "CFU/mL, dilution factor, McFarland standards", icon: Bug },
  { href: "/lab-tools/spectrophotometry", label: "Spectrophotometry", description: "Beer-Lambert, %T, calibration curves", icon: Waves },
]

export default function LabToolsPage() {
  return (
    <PageContainer title="Lab Tools" description="Solution preparation, dilution, microbiology, and spectrophotometry tools for bench work.">
      <div className="grid gap-3 sm:grid-cols-2">
        {labTools.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="h-full hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center gap-3 py-4">
                <tool.icon className="h-5 w-5 text-primary shrink-0" aria-hidden />
                <div>
                  <CardTitle className="text-base">{tool.label}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  )
}
