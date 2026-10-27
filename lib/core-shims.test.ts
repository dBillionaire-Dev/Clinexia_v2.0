import { describe, expect, it } from "vitest"
import * as s0 from "@/lib/calculators/calculation-safety"
import * as c0 from "@clinexia/core/calculators/calculation-safety"
import * as s1 from "@/lib/calculators/clinical-audit"
import * as c1 from "@clinexia/core/calculators/clinical-audit"
import * as s2 from "@/lib/calculators/coding-metadata"
import * as c2 from "@clinexia/core/calculators/coding-metadata"
import * as s3 from "@/lib/calculators/date-helpers"
import * as c3 from "@clinexia/core/calculators/date-helpers"
import * as s4 from "@/lib/calculators/definitions/cardiovascular"
import * as c4 from "@clinexia/core/calculators/definitions/cardiovascular"
import * as s5 from "@/lib/calculators/definitions/chemistry"
import * as c5 from "@clinexia/core/calculators/definitions/chemistry"
import * as s6 from "@/lib/calculators/definitions/clinical"
import * as c6 from "@clinexia/core/calculators/definitions/clinical"
import * as s7 from "@/lib/calculators/definitions/dosing"
import * as c7 from "@clinexia/core/calculators/definitions/dosing"
import * as s8 from "@/lib/calculators/definitions/everyday"
import * as c8 from "@clinexia/core/calculators/definitions/everyday"
import * as s9 from "@/lib/calculators/definitions/hematology"
import * as c9 from "@clinexia/core/calculators/definitions/hematology"
import * as s10 from "@/lib/calculators/definitions/lab-solutions"
import * as c10 from "@clinexia/core/calculators/definitions/lab-solutions"
import * as s11 from "@/lib/calculators/definitions/microbiology"
import * as c11 from "@clinexia/core/calculators/definitions/microbiology"
import * as s12 from "@/lib/calculators/definitions/oncology"
import * as c12 from "@clinexia/core/calculators/definitions/oncology"
import * as s13 from "@/lib/calculators/definitions/renal"
import * as c13 from "@clinexia/core/calculators/definitions/renal"
import * as s14 from "@/lib/calculators/definitions/spectrophotometry"
import * as c14 from "@clinexia/core/calculators/definitions/spectrophotometry"
import * as s15 from "@/lib/calculators/definitions/stem-cell-transplant"
import * as c15 from "@clinexia/core/calculators/definitions/stem-cell-transplant"
import * as s16 from "@/lib/calculators/dose-volume"
import * as c16 from "@clinexia/core/calculators/dose-volume"
import * as s17 from "@/lib/calculators/dosing-references"
import * as c17 from "@clinexia/core/calculators/dosing-references"
import * as s18 from "@/lib/calculators/dosing-safety"
import * as c18 from "@clinexia/core/calculators/dosing-safety"
import * as s19 from "@/lib/calculators/everyday-references"
import * as c19 from "@clinexia/core/calculators/everyday-references"
import * as s20 from "@/lib/calculators/formula-info"
import * as c20 from "@clinexia/core/calculators/formula-info"
import * as s21 from "@/lib/calculators/helpers"
import * as c21 from "@clinexia/core/calculators/helpers"
import * as s22 from "@/lib/calculators/reference-gaps"
import * as c22 from "@clinexia/core/calculators/reference-gaps"
import * as s23 from "@/lib/calculators/registry"
import * as c23 from "@clinexia/core/calculators/registry"
import * as s24 from "@/lib/calculators/test-vectors"
import * as c24 from "@clinexia/core/calculators/test-vectors"
import * as s25 from "@/lib/calculators/treatment-engine"
import * as c25 from "@clinexia/core/calculators/treatment-engine"
import * as s26 from "@/lib/calculators/treatment-regimens"
import * as c26 from "@clinexia/core/calculators/treatment-regimens"
import * as s27 from "@/lib/calculators/types"
import * as c27 from "@clinexia/core/calculators/types"
import * as s28 from "@/lib/calculators/validation"
import * as c28 from "@clinexia/core/calculators/validation"
import * as s29 from "@/lib/calculators/versions"
import * as c29 from "@clinexia/core/calculators/versions"
import * as s30 from "@/lib/conversions/data/concentration"
import * as c30 from "@clinexia/core/conversions/data/concentration"
import * as s31 from "@/lib/conversions/data/energy"
import * as c31 from "@clinexia/core/conversions/data/energy"
import * as s32 from "@/lib/conversions/data/length"
import * as c32 from "@clinexia/core/conversions/data/length"
import * as s33 from "@/lib/conversions/data/mass"
import * as c33 from "@clinexia/core/conversions/data/mass"
import * as s34 from "@/lib/conversions/data/pressure"
import * as c34 from "@clinexia/core/conversions/data/pressure"
import * as s35 from "@/lib/conversions/data/temperature"
import * as c35 from "@clinexia/core/conversions/data/temperature"
import * as s36 from "@/lib/conversions/data/time"
import * as c36 from "@clinexia/core/conversions/data/time"
import * as s37 from "@/lib/conversions/data/volume"
import * as c37 from "@clinexia/core/conversions/data/volume"
import * as s38 from "@/lib/conversions/density"
import * as c38 from "@clinexia/core/conversions/density"
import * as s39 from "@/lib/conversions/engine"
import * as c39 from "@clinexia/core/conversions/engine"
import * as s40 from "@/lib/conversions/molar-mass"
import * as c40 from "@clinexia/core/conversions/molar-mass"
import * as s41 from "@/lib/conversions/registry"
import * as c41 from "@clinexia/core/conversions/registry"
import * as s42 from "@/lib/conversions/substances"
import * as c42 from "@clinexia/core/conversions/substances"
import * as s43 from "@/lib/conversions/types"
import * as c43 from "@clinexia/core/conversions/types"
import * as s44 from "@/lib/integration/normalise"
import * as c44 from "@clinexia/core/integration/normalise"
import * as s45 from "@/lib/integration/prefill"
import * as c45 from "@clinexia/core/integration/prefill"
import * as s46 from "@/lib/integration/units"
import * as c46 from "@clinexia/core/integration/units"

/**
 * GENERATED by the Phase 5 extraction. Every old import path (lib/calculators/..., lib/conversions/..., lib/integration/...) is a
 * one-line re-export of @clinexia/core. This proves it: same export names, and each export is the very same object, so the app
 * and the package share one copy of every calculator and nothing behaves differently because of the move.
 */
const PAIRS: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
  ["lib/calculators/calculation-safety", s0, c0],
  ["lib/calculators/clinical-audit", s1, c1],
  ["lib/calculators/coding-metadata", s2, c2],
  ["lib/calculators/date-helpers", s3, c3],
  ["lib/calculators/definitions/cardiovascular", s4, c4],
  ["lib/calculators/definitions/chemistry", s5, c5],
  ["lib/calculators/definitions/clinical", s6, c6],
  ["lib/calculators/definitions/dosing", s7, c7],
  ["lib/calculators/definitions/everyday", s8, c8],
  ["lib/calculators/definitions/hematology", s9, c9],
  ["lib/calculators/definitions/lab-solutions", s10, c10],
  ["lib/calculators/definitions/microbiology", s11, c11],
  ["lib/calculators/definitions/oncology", s12, c12],
  ["lib/calculators/definitions/renal", s13, c13],
  ["lib/calculators/definitions/spectrophotometry", s14, c14],
  ["lib/calculators/definitions/stem-cell-transplant", s15, c15],
  ["lib/calculators/dose-volume", s16, c16],
  ["lib/calculators/dosing-references", s17, c17],
  ["lib/calculators/dosing-safety", s18, c18],
  ["lib/calculators/everyday-references", s19, c19],
  ["lib/calculators/formula-info", s20, c20],
  ["lib/calculators/helpers", s21, c21],
  ["lib/calculators/reference-gaps", s22, c22],
  ["lib/calculators/registry", s23, c23],
  ["lib/calculators/test-vectors", s24, c24],
  ["lib/calculators/treatment-engine", s25, c25],
  ["lib/calculators/treatment-regimens", s26, c26],
  ["lib/calculators/types", s27, c27],
  ["lib/calculators/validation", s28, c28],
  ["lib/calculators/versions", s29, c29],
  ["lib/conversions/data/concentration", s30, c30],
  ["lib/conversions/data/energy", s31, c31],
  ["lib/conversions/data/length", s32, c32],
  ["lib/conversions/data/mass", s33, c33],
  ["lib/conversions/data/pressure", s34, c34],
  ["lib/conversions/data/temperature", s35, c35],
  ["lib/conversions/data/time", s36, c36],
  ["lib/conversions/data/volume", s37, c37],
  ["lib/conversions/density", s38, c38],
  ["lib/conversions/engine", s39, c39],
  ["lib/conversions/molar-mass", s40, c40],
  ["lib/conversions/registry", s41, c41],
  ["lib/conversions/substances", s42, c42],
  ["lib/conversions/types", s43, c43],
  ["lib/integration/normalise", s44, c44],
  ["lib/integration/prefill", s45, c45],
  ["lib/integration/units", s46, c46],
]

describe("old import paths are pure re-exports of @clinexia/core", () => {
  it("covers every shim", () => {
    expect(PAIRS.length).toBe(47)
  })
  for (const [name, shim, core] of PAIRS) {
    it(name, () => {
      expect(Object.keys(shim).sort()).toEqual(Object.keys(core).sort())
      for (const key of Object.keys(core)) expect(shim[key], key).toBe(core[key])
    })
  }
})
