// clinexia-upgrade:phase1 — extra search terms for tools: abbreviations and the names clinicians actually type.
// Keyed by calculator id. A test fails if an id here is not a real tool, so this list cannot silently drift.

export const TOOL_SYNONYMS: Record<string, string[]> = {
  "creatinine-clearance": ["cockcroft gault", "cockcroft-gault", "cg", "crcl", "kidney function", "renal function"],
  "egfr-ckd-epi": ["ckd epi", "ckdepi", "gfr", "kidney function", "renal function"],
  "egfr-mdrd": ["mdrd", "gfr", "kidney function"],
  "bun-creatinine-ratio": ["urea creatinine ratio", "prerenal", "aki"],
  fena: ["fractional excretion of sodium", "aki", "prerenal"],
  bmi: ["body mass index", "obesity", "overweight"],
  bsa: ["body surface area"],
  "ideal-body-weight": ["ibw", "devine"],
  "mean-arterial-pressure": ["map", "blood pressure", "bp"],
  "pulse-pressure": ["pp", "blood pressure"],
  "ejection-fraction": ["lvef", "ef", "echo", "heart failure"],
  "cardiac-index": ["ci", "cardiac output"],
  "qtc-correction": ["qt", "bazett", "fridericia", "long qt", "ecg"],
  "cha2ds2-vasc": ["chads vasc", "chadsvasc", "chads2 vasc", "af stroke risk", "atrial fibrillation stroke", "anticoagulation af"],
  "has-bled": ["hasbled", "af bleeding risk", "anticoagulant bleeding risk", "atrial fibrillation bleeding"],
  "dapt-score": ["dual antiplatelet", "dapt", "pci duration", "stent"],
  "anion-gap": ["ag", "metabolic acidosis"],
  "corrected-calcium": ["albumin adjusted calcium", "adjusted calcium"],
  "ldl-friedewald": ["ldl", "lipid", "cholesterol", "friedewald"],
  inr: ["warfarin", "coagulation", "prothrombin"],
  "estimated-osmolality": ["osmolality", "osmolarity", "osmolal gap"],
  "hba1c-eag": ["a1c", "glycated hemoglobin", "average glucose"],
  "red-cell-indices": ["mcv", "mch", "mchc", "cbc", "anemia"],
  qsofa: ["quick sofa", "sepsis screen", "sepsis"],
  sofa: ["sequential organ failure", "sepsis", "icu", "organ failure"],
  "pecarn-head-injury-under-2": ["pecarn", "head injury", "head trauma", "child", "infant", "ct head"],
  "pecarn-head-injury-2-to-17": ["pecarn", "head injury", "head trauma", "child", "paediatric", "ct head"],
}

export function getToolSynonyms(id: string): string[] {
  return TOOL_SYNONYMS[id] ?? []
}

/** True when the whole query is exactly one of this tool's synonyms (for example "crcl"). Used to rank that tool first. */
export function hasExactSynonym(id: string, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ")
  return q !== "" && getToolSynonyms(id).some((s) => s.toLowerCase() === q)
}
