import { PageContainer } from "@/components/page-container"
import { MolarMassConverter } from "@/components/conversions/molar-mass-converter"

export const metadata = { title: "Molar ↔ Mass Concentration - Clinexia", alternates: { canonical: "/conversions/molar-mass" } }

export default function MolarMassPage() {
  return (
    <PageContainer>
      <h1 className="sr-only">Molar to Mass Concentration Conversion</h1>
      <MolarMassConverter />
    </PageContainer>
  )
}
