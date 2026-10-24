"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { PremiumGate } from "@/components/account/premium-gate"
import { AccessBadge } from "@/components/account/access-badge"
import { Calculator, Copy, Save, Share2, Star, AlertTriangle, FileDown, RotateCcw } from "lucide-react"
import type { CalculatorDefinition, CalculationResult } from "@/lib/calculators/types"
import { CALCULATION_DISCLAIMER } from "@/lib/calculators/types"
import { ClinicalUseNotice } from "@/components/clinical-use-notice"
import { SHARE_FOOTER, isHighRiskCategory } from "@/lib/legal"
import { getCalculatorById, getRecommendedCalculators } from "@/lib/calculators/registry"
import { CalculatorField } from "./calculator-field"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { isFavorite, toggleFavorite } from "@/lib/favorites"
import { recordUsage } from "@/lib/recently-used"
import { trackCalculation } from "@/lib/analytics/track-calculation"
import { useHistory } from "@/lib/history/use-history"
import { cn } from "@/lib/utils"
import { getDosingSafetyWarnings, validateCalculatorInputBounds } from "@/lib/calculators/dosing-safety"
import { getCalculatorSafetyWarnings } from "@/lib/calculators/calculation-safety"
import { getCalculatorReferences } from "@/lib/calculators/dosing-references"
import { parsePrefill } from "@/lib/integration/prefill"
import {
  buildReadyMessage,
  buildResultMessage,
  formulaVersionFor,
  isTrustedParentMessage,
  parsePrefillMessage,
  postToParent,
  type EmbedConfig,
} from "@/lib/integration/embed-bridge"

function defaultValues(def: CalculatorDefinition | undefined): Record<string, string> {
  if (!def) return {}
  const values: Record<string, string> = {}
  for (const input of def.inputs) {
    // Select inputs need a real pre-selected value (there's no equivalent of a
    // placeholder for a dropdown). Number inputs start empty  -  their
    // defaultValue is shown as a placeholder hint instead (see CalculatorField).
    values[input.id] = input.kind === "select" && input.defaultValue !== undefined ? String(input.defaultValue) : ""
  }
  return values
}

function CalculatorRunnerInner({ calculatorId, embed }: { calculatorId: string; embed?: EmbedConfig }) {
  const definition = getCalculatorById(calculatorId)
  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(definition))
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedToHistory, setSavedToHistory] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [favorite, setFavorite] = useState(() => (definition ? isFavorite(definition.id) : false))
  const { toast } = useToast()
  const { record } = useHistory()
  const related = useMemo(() => (definition ? getRecommendedCalculators(definition) : []), [definition])
  const references = useMemo(() => (definition ? getCalculatorReferences(definition) : []), [definition])
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  const lastParsedInputsRef = useRef<Record<string, number | string> | null>(null)
  const valuesRef = useRef(values)
  valuesRef.current = values
  const handleCalculateRef = useRef<((override?: Record<string, string>) => Promise<void>) | null>(null)
  const prefillAppliedRef = useRef(false)

  // Deep links (?age=54&weight=70&creatinine=1.2&sex=male): each value is validated against its input; invalid or unknown
  // ones are ignored. Nothing is calculated unless the link also has calculate=1. Values are never logged or sent anywhere.
  useEffect(() => {
    if (!definition || prefillAppliedRef.current) return
    prefillAppliedRef.current = true
    const prefill = parsePrefill(definition, new URLSearchParams(window.location.search))
    if (Object.keys(prefill.values).length === 0) return
    const merged = { ...defaultValues(definition), ...prefill.values }
    setValues(merged)
    if (prefill.calculate) void handleCalculateRef.current?.(merged)
  }, [definition])

  // Embedded with ?postMessage=1: announce readiness and accept prefill messages from the allowlisted parent only.
  useEffect(() => {
    if (!definition || !embed?.postMessage || !embed.parentOrigin) return
    const parentOrigin = embed.parentOrigin
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedParentMessage(event, parentOrigin, window.parent)) return
      const message = parsePrefillMessage(event.data)
      if (!message) return
      const prefill = parsePrefill(definition, message.values)
      const merged = { ...valuesRef.current, ...prefill.values }
      if (Object.keys(prefill.values).length > 0) setValues(merged)
      if (message.calculate) void handleCalculateRef.current?.(merged)
    }
    window.addEventListener("message", onMessage)
    postToParent(window.parent, parentOrigin, buildReadyMessage(definition.id))
    return () => window.removeEventListener("message", onMessage)
  }, [definition, embed?.postMessage, embed?.parentOrigin])

  if (!definition) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <p className="font-medium">Calculator not found</p>
          <p className="text-sm text-muted-foreground">
            This tool may have moved or the link may be out of date.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }))
  }

  const resolvedInputs = definition.inputs.map((input) => {
    const raw = values[input.id] ?? ""
    let display = raw
    if (input.kind === "select") {
      display = input.options?.find((opt) => opt.value === raw)?.label ?? raw
    } else if (input.unit && raw !== "") {
      display = `${raw} ${input.unit}`
    }
    return { label: input.label, display: display || "" }
  })

  const saveResultToHistory = async (parsed: Record<string, number | string>, calcResult: CalculationResult) => {
    try {
      await record({
        calculatorId: definition.id,
        calculatorName: definition.name,
        category: definition.category,
        inputs: parsed,
        result: calcResult.value,
        unit: calcResult.unit,
      })
      setSavedToHistory(true)
    } catch {
      setSavedToHistory(false)
      toast({ description: "The result could not be saved to local history." })
    }
  }

  const handleCalculate = async (override?: Record<string, string>) => {
    if (calculating) return
    setError(null)
    setSavedToHistory(false)
    setCalculating(true)
    try {
      const parsed: Record<string, number | string> = {}
      const source = override ?? values
      for (const input of definition.inputs) {
        const raw = source[input.id] ?? ""
        if (raw === "" && !input.optional) {
          throw new Error(`${input.label} is required.`)
        }
        parsed[input.id] = input.kind === "number" ? (raw === "" ? "" : raw) : raw
      }

      validateCalculatorInputBounds(definition, parsed)
      const calcResult = definition.calculate(parsed)
      const safetyWarnings = getDosingSafetyWarnings(definition, parsed, calcResult)
      const generalSafetyWarnings = getCalculatorSafetyWarnings(definition, parsed, calcResult)
      const mergedWarnings = [...(calcResult.warnings ?? []), ...safetyWarnings, ...generalSafetyWarnings]
      const finalResult = {
        ...calcResult,
        warnings: mergedWarnings.length ? Array.from(new Set(mergedWarnings)) : undefined,
      }

      lastParsedInputsRef.current = parsed
      setResult(finalResult)
      // Embedded views never keep usage or history: saving to history also reports to analytics.
      if (!embed) {
        recordUsage(definition.id)
        await saveResultToHistory(parsed, finalResult)
      }
      if (embed?.postMessage) {
        postToParent(window.parent, embed.parentOrigin, buildResultMessage(definition.id, formulaVersionFor(definition.id), finalResult))
      }
      requestAnimationFrame(() => resultHeadingRef.current?.focus())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to calculate this result.")
    } finally {
      setCalculating(false)
    }
  }

  handleCalculateRef.current = handleCalculate

  const handleReset = () => {
    setValues(defaultValues(definition))
    setResult(null)
    setError(null)
    setSavedToHistory(false)
    lastParsedInputsRef.current = null
  }

  const regimenSummary = useMemo(() => {
    if (definition.category !== "dosing" || !result) return []

    const fields = result.secondary ?? []
    const wanted = [
      "Dose per administration",
      "Calculated dose",
      "Dose",
      "Dose frequency",
      "Frequency",
      "Route",
      "Duration",
      "Treatment duration",
      "Doses",
      "Total tablets",
      "Total units",
      "Total course dose",
      "Daily total",
    ]

    return wanted
      .map((label) => fields.find((field) => field.label === label))
      .filter((field): field is NonNullable<typeof field> => Boolean(field))
      .slice(0, 8)
  }, [definition.category, result])

  const resultText = () => {
    if (!result) return ""
    const lines = [
      `Clinexia, ${definition.name}`,
      "",
      `Result: ${result.display}`,
      "",
      "Inputs",
      ...resolvedInputs.map((input) => `${input.label}: ${input.display}`),
    ]
    if (definition.formula) lines.push("", `Formula: ${definition.formula}`)
    lines.push("", SHARE_FOOTER)
    return lines.join("\n")
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resultText())
      toast({ description: "Result copied to clipboard." })
    } catch {
      toast({ description: "Couldn't copy, try selecting the text manually." })
    }
  }

  const handleShare = async () => {
    const text = resultText()
    if (navigator.share) {
      try {
        await navigator.share({ title: definition.name, text })
      } catch {
        // user cancelled, no-op
      }
    } else {
      handleCopy()
    }
  }

  const handleExportPdf = () => {
    // Uses the browser's native print-to-PDF rather than a client-side PDF
    // library, no extra dependency, works fully offline, and every browser
    // supports "Save as PDF" from the print dialog. A dedicated print
    // stylesheet hides site chrome and shows only the result.
    window.print()
  }

  const handleFavorite = () => {
    const nowFavorite = toggleFavorite(definition.id)
    setFavorite(nowFavorite)
  }

  return (
    <div className="space-y-6 [content-visibility:auto]">
      <Card className="print:hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" aria-hidden />
              <CardTitle>{definition.name}<AccessBadge id={definition.id} category={definition.category} /></CardTitle>
              {definition.isEstimator ? <Badge variant="secondary">Estimator</Badge> : null}
            </div>
            <CardDescription className="mt-1.5">{definition.description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            
            {!embed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              title={favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={handleFavorite}
            >
              <Star className={cn("h-5 w-5", favorite && "fill-yellow-400 text-yellow-400")} />
            </Button>
            ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset calculator"
            onClick={handleReset}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <ClinicalUseNotice category={definition.category} />
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCalculate()
            }}
            noValidate
            aria-label={`${definition.name} calculator`}
          >
          <div className="grid gap-4 sm:grid-cols-2">
            {definition.inputs.map((input) => (
              <CalculatorField
                key={input.id}
                input={input}
                value={values[input.id] ?? ""}
                onChange={(v) => handleChange(input.id, v)}
                onEnter={handleCalculate}
              />
            ))}
          </div>

          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <Button type="submit" disabled={calculating} aria-busy={calculating} className="w-full sm:w-auto">
            {calculating ? "Calculating…" : "Calculate"}
          </Button>
          </form>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {calculating ? "Calculating result." : result ? `Result ready: ${result.display}` : ""}
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card aria-live="polite">
          <CardHeader>
            {/* Print-only masthead  -  site header/nav is hidden when printing */}
            <div className="hidden print:block mb-2">
              <p className="font-bold">Clinexia</p>
              <p className="text-xs text-muted-foreground">{definition.name}  -  {new Date().toLocaleDateString()}</p>
            </div>
            <CardTitle ref={resultHeadingRef} tabIndex={-1} className="text-sm font-medium text-muted-foreground focus:outline-none">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {definition.category === "dosing" ? (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Calculated result</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">{result.display}</p>
                </div>
                {result.secondary?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {result.secondary.map((field) => (
                      <div key={field.label} className="rounded-md border bg-background p-3">
                        <p className="text-xs text-muted-foreground">{field.label}</p>
                        <p className="mt-1 text-sm font-semibold break-words">{field.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold tracking-tight">{result.display}</div>
                {result.secondary?.length ? (
                  <dl className="grid gap-1.5 text-sm">
                    {result.secondary.map((field) => (
                      <div key={field.label} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{field.label}</dt>
                        <dd className="font-medium">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </>
            )}

            {regimenSummary.length ? (
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">Regimen summary</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Reference details returned by this calculator; no regimen details are inferred.</p>
                </div>
                <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {regimenSummary.map((field) => (
                    <div key={`regimen-${field.label}`} className="rounded-md border bg-muted/20 p-2.5">
                      <dt className="text-xs text-muted-foreground">{field.label}</dt>
                      <dd className="mt-1 text-sm font-semibold break-words">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {result.warnings?.length ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Safety &amp; warnings</h4>
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div>
              <Separator className="mb-3" />
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Inputs</h4>
              <dl className="grid gap-1.5 text-sm">
                {resolvedInputs.map((input) => (
                  <div key={input.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{input.label}</dt>
                    <dd className="font-medium">{input.display}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {definition.formula ? (
              <div>
                <Separator className="mb-3" />
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Formula</h4>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted rounded-md p-3">{definition.formula}</pre>
              </div>
            ) : null}

            {result.calculationSteps?.length ? (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Calculation</h4>
                <div className="text-sm font-mono bg-muted rounded-md p-3 space-y-1">
                  {result.calculationSteps.map((step, i) => (
                    <div key={i}>{step}</div>
                  ))}
                </div>
              </div>
            ) : null}

            {result.interpretation ? (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Interpretation</h4>
                <p className="text-sm">{result.interpretation}</p>
              </div>
            ) : null}

            {references.length ? (
              <div>
                <Separator className="mb-3" />
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Reference &amp; protocol</h4>
                <div className="space-y-3 text-sm">
                  {references.map((reference, index) => (
                    <div key={`${reference.source}-${index}`} className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{reference.source}</p>
                        {reference.status ? (
                          <Badge variant={reference.status === "current" ? "secondary" : "outline"}>
                            {reference.status === "current" ? "Current" : reference.status === "supporting" ? "Supporting" : "Review needed"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground">Version: {reference.version}</p>
                      {reference.applicablePopulation ? <p><span className="font-medium">Population:</span> {reference.applicablePopulation}</p> : null}
                      {reference.indication ? <p><span className="font-medium">Indication:</span> {reference.indication}</p> : null}
                      <p className="text-muted-foreground">Last verified: {reference.lastVerified}</p>
                      {reference.note ? <p className="text-muted-foreground">{reference.note}</p> : null}
                      {reference.url ? (
                        <a href={reference.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                          Open source
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(definition.notes?.length || definition.limitations?.length) ? (
              <div>
                <Separator className="mb-3" />
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  {definition.notes?.map((n, i) => (
                    <li key={`n-${i}`}>{n}</li>
                  ))}
                  {definition.limitations?.map((n, i) => (
                    <li key={`l-${i}`}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Separator />
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-1.5" /> Copy
              </Button>
              {!embed ? (
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!result || !lastParsedInputsRef.current) return
                  if (savedToHistory) {
                    toast({ description: "This result is already saved to history." })
                    return
                  }
                  void saveResultToHistory(lastParsedInputsRef.current, result)
                }}
                disabled={!result}
              >
                <Save className="h-4 w-4 mr-1.5" /> {savedToHistory ? "Saved" : "Save to history"}
              </Button>
            ) : null}
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1.5" /> Share
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <FileDown className="h-4 w-4 mr-1.5" /> Export PDF
              </Button>
            </div>

            {definition.category === "dosing" ? (
              <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">Dose safety check</p>
                <p className="mt-1 text-amber-800 dark:text-amber-300">This result has been checked for input bounds and basic plausibility. It does not replace drug-specific dosing guidance, clinical assessment or therapeutic monitoring.</p>
              </div>
            ) : null}
            {!embed ? <p className="text-xs text-muted-foreground">{CALCULATION_DISCLAIMER}</p> : null}
            {isHighRiskCategory(definition.category) ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">Results are calculation aids, not prescriptions or treatment orders. Verify the indication, patient population, route, formulation, maximum dose, current guideline and local protocol before acting on them.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!embed && related.length ? (
        <div className="print:hidden">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Related &amp; recommended tools</h3>
          <div className="flex flex-wrap gap-2">
            {related.map((tool) => (
              <Link key={tool.id} href={`/calculators/${tool.category}/${tool.id}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                  {tool.shortName ?? tool.name}<AccessBadge id={tool.id} category={tool.category} />
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Public entry point: the runner behind the premium lock (a no-op unless locking is switched on). */
export function CalculatorRunner({ calculatorId, embed }: { calculatorId: string; embed?: EmbedConfig }) {
  return (
    <PremiumGate id={calculatorId}>
      <CalculatorRunnerInner calculatorId={calculatorId} embed={embed} />
    </PremiumGate>
  )
}
