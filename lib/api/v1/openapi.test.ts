import { describe, expect, it } from "vitest"
import { calculators } from "@/lib/calculators/registry"
import { generateOpenApi, openApiCalculators } from "./openapi"

type Spec = ReturnType<typeof generateOpenApi> & { paths: Record<string, Record<string, { security?: unknown[] }>> }
const spec = generateOpenApi() as Spec
const isDosing = (c: { category: string }) => c.category === "dosing" || c.category === "oncology"

describe("OpenAPI document", () => {
  it("is OpenAPI 3.1 with bearer auth", () => {
    expect(spec.openapi).toBe("3.1.0")
    expect(spec.info.version).toBe("v1")
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe("bearer")
    expect(spec.servers[0].url).toBe("/api/v1")
  })

  it("lists EVERY non-dosing calculator as its own calculate path", () => {
    const nonDosing = calculators.filter((c) => !isDosing(c))
    expect(nonDosing.length).toBeGreaterThan(80)
    for (const c of nonDosing) {
      expect(spec.paths[`/calculators/${c.id}/calculate`], c.id).toBeDefined()
      expect(spec.components.schemas[`Inputs_${c.id}` as keyof typeof spec.components.schemas], c.id).toBeDefined()
    }
    expect(openApiCalculators().length).toBe(nonDosing.length)
    const detail = spec.paths["/calculators/{id}"] as { get: { parameters: { schema: { enum: string[] } }[] } }
    expect([...detail.get.parameters[0].schema.enum].sort()).toEqual(nonDosing.map((c) => c.id).sort())
  })

  it("does not enumerate dosing or oncology calculators anywhere", () => {
    const text = JSON.stringify(spec)
    for (const c of calculators.filter(isDosing)) expect(text.includes(`"${c.id}"`) || text.includes(`/${c.id}/`) || text.includes(`Inputs_${c.id}"`), c.id).toBe(false)
    expect(spec.info.description).toContain("calculate:dosing")
  })

  it("documents each calculator's inputs: required ids, enums, bounds, unit-aware numbers", () => {
    const crcl = spec.components.schemas["Inputs_creatinine-clearance" as keyof typeof spec.components.schemas] as { required: string[]; properties: Record<string, { enum?: string[]; oneOf?: unknown[] }> }
    expect([...crcl.required].sort()).toEqual(["age", "creatinine", "sex", "weight"])
    expect(crcl.properties.sex.enum).toEqual(["male", "female"])
    expect(crcl.properties.creatinine.oneOf?.length).toBe(2)
    const bmi = spec.components.schemas["Inputs_bmi" as keyof typeof spec.components.schemas] as { required: string[] }
    expect(bmi.required).toEqual(["weight", "height"]) // the unit selects are filled automatically
  })

  it("protects every operation except health and the document itself", () => {
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const op of Object.values(ops)) {
        const open = path === "/health" || path === "/openapi.json"
        expect(Array.isArray(op.security) && op.security.length === 0, path).toBe(open)
      }
    }
  })

  it("is generated, not stored: two builds are identical", () => {
    expect(JSON.stringify(generateOpenApi())).toBe(JSON.stringify(generateOpenApi()))
  })
})
