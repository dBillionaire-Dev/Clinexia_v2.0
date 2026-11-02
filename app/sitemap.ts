import type { MetadataRoute } from "next"
import { calculatorCategories, calculators } from "@/lib/calculators/registry"
import { conversionCategories } from "@/lib/conversions/registry"

const BASE_URL = "https://www.clinexia.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const entry = (path: string) => ({ url: `${BASE_URL}${path}`, lastModified })

  return [
    entry("/"),
    entry("/welcome"),
    entry("/privacy"),
    entry("/terms"),
    entry("/calculators"),
    entry("/conversions"),
    entry("/lab-tools"),
    entry("/estimators"),
    entry("/conversions/height"),
    entry("/conversions/mass-volume"),
    entry("/conversions/molar-mass"),
    ...conversionCategories.map((category) => entry(`/conversions/${category.id}`)),
    entry("/lab-tools/dilution"),
    entry("/lab-tools/serial-dilution"),
    entry("/lab-tools/percentage-solution"),
    entry("/lab-tools/microbiology"),
    entry("/lab-tools/spectrophotometry"),
    ...calculatorCategories.map((category) => entry(`/calculators/${category.id}`)),
    ...calculators.map((calculator) => entry(`/calculators/${calculator.category}/${calculator.id}`)),
  ]
}
