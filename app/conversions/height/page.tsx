import type { Metadata } from "next"
import { PageContainer } from "@/components/page-container"
import { HeightConverter } from "@/components/conversions/height-converter"
import { breakdownFromCm, formatFeetInches, formatHeightNumber } from "@/lib/conversions/height"

const TITLE = "Height Converter: cm to Feet and Inches, m to ft"
const DESCRIPTION =
  "Free height converter. Convert centimeters, meters, millimeters, feet and inches to each other, including feet and inches (5 ft 10 in) to cm. Exact 2.54 cm per inch, works offline."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/conversions/height" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/conversions/height", type: "website", images: [{ url: "/og-image.png", alt: "Clinexia height converter" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
}

const COMMON_CM = [150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200]

export default function HeightConverterPage() {
  const rows = COMMON_CM.map((cm) => {
    const b = breakdownFromCm(cm)
    return b ? { cm, m: formatHeightNumber(b.m, 2), ftIn: formatFeetInches(b.feetInches) } : null
  }).filter((r): r is { cm: number; m: string; ftIn: string } => r !== null)

  return (
    <PageContainer>
      <h1 className="sr-only">Height Converter: cm, m, feet and inches</h1>
      <HeightConverter />

      <section className="mt-8 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">How to convert height</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Centimeters to inches: divide by 2.54.</li>
          <li>Inches to centimeters: multiply by 2.54.</li>
          <li>Feet and inches to centimeters: (feet × 12 + inches) × 2.54.</li>
          <li>Centimeters to feet and inches: divide by 2.54 to get total inches, then 12 inches make one foot.</li>
          <li>Meters to centimeters: multiply by 100.</li>
        </ul>
        <p>Height is used for BMI, body surface area, ideal body weight and many paediatric and renal formulas, so an unnoticed unit slip changes the result. Check the unit before you enter a height in a calculator.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold mb-2">Common heights</h2>
        <div className="overflow-x-auto">
          <table className="w-full max-w-md text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1.5 pr-4 font-medium">cm</th>
                <th className="py-1.5 pr-4 font-medium">m</th>
                <th className="py-1.5 font-medium">ft / in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cm} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">{r.cm}</td>
                  <td className="py-1.5 pr-4">{r.m}</td>
                  <td className="py-1.5">{r.ftIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageContainer>
  )
}
