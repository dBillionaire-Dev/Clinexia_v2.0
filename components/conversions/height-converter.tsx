"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Copy, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { recordUsage } from "@/lib/recently-used"
import { trackCalculation } from "@/lib/analytics/track-calculation"
import {
  PLAUSIBLE_ADULT_HEIGHT_CM,
  breakdownFromCm,
  convertHeight,
  feetInchesToCm,
  formatFeetInches,
  formatHeightNumber,
  type HeightUnit,
} from "@/lib/conversions/height"

type Field = HeightUnit | "ftin"

const SINGLE_FIELDS: { id: HeightUnit; label: string; decimals: number }[] = [
  { id: "cm", label: "Centimeters (cm)", decimals: 1 },
  { id: "m", label: "Meters (m)", decimals: 3 },
  { id: "mm", label: "Millimeters (mm)", decimals: 0 },
  { id: "ft", label: "Feet, decimal (ft)", decimals: 3 },
  { id: "in", label: "Inches (in)", decimals: 1 },
]

/** Whichever box you type in is the source; every other box is recalculated from it. */
export function HeightConverter() {
  const [source, setSource] = useState<Field>("cm")
  const [raw, setRaw] = useState("")
  const [feetRaw, setFeetRaw] = useState("")
  const [inchesRaw, setInchesRaw] = useState("")
  const { toast } = useToast()

  const cm = useMemo(() => {
    if (source === "ftin") {
      if (feetRaw.trim() === "" && inchesRaw.trim() === "") return null
      return feetInchesToCm(Number(feetRaw || 0), Number(inchesRaw || 0))
    }
    if (raw.trim() === "") return null
    return convertHeight(Number(raw), source, "cm")
  }, [source, raw, feetRaw, inchesRaw])

  const breakdown = cm === null ? null : breakdownFromCm(cm)

  useEffect(() => {
    if (cm === null) return
    const timer = window.setTimeout(() => {
      recordUsage("conversion:height")
      void trackCalculation({ calculatorId: "conversion:height", calculatorName: "Height Conversion", category: "conversions" })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [cm])

  const reset = () => {
    setSource("cm")
    setRaw("")
    setFeetRaw("")
    setInchesRaw("")
  }

  const shown = (id: HeightUnit, decimals: number) => {
    if (source === id) return raw
    return breakdown ? formatHeightNumber(breakdown[id], decimals) : ""
  }

  const outOfRange = cm !== null && (cm < PLAUSIBLE_ADULT_HEIGHT_CM.min || cm > PLAUSIBLE_ADULT_HEIGHT_CM.max)

  const copy = async () => {
    if (!breakdown) return
    const text = `${formatHeightNumber(breakdown.cm, 1)} cm = ${formatHeightNumber(breakdown.m, 3)} m = ${formatFeetInches(breakdown.feetInches)}`
    try {
      await navigator.clipboard.writeText(text)
      toast({ description: "Result copied to clipboard." })
    } catch {
      toast({ description: "Couldn't copy, try selecting the text manually." })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Height Converter</CardTitle>
          <CardDescription>Type in any box. Centimeters, meters, millimeters, feet, inches and feet + inches update together.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" aria-label="Reset height converter" onClick={reset}>
          <RotateCcw className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {SINGLE_FIELDS.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={`height-${f.id}`}>{f.label}</Label>
              <Input
                id={`height-${f.id}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={shown(f.id, f.decimals)}
                onChange={(e) => {
                  setSource(f.id)
                  setRaw(e.target.value)
                }}
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label>Feet and inches (5 ft 10 in)</Label>
          <div className="flex items-center gap-2 max-w-sm">
            <Input
              aria-label="Feet"
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              placeholder="ft"
              value={source === "ftin" ? feetRaw : breakdown ? String(breakdown.feetInches.feet) : ""}
              onChange={(e) => {
                setSource("ftin")
                setFeetRaw(e.target.value)
                if (source !== "ftin") setInchesRaw(breakdown ? String(breakdown.feetInches.inches) : "")
              }}
            />
            <span className="text-sm text-muted-foreground">ft</span>
            <Input
              aria-label="Inches"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="in"
              value={source === "ftin" ? inchesRaw : breakdown ? String(breakdown.feetInches.inches) : ""}
              onChange={(e) => {
                setSource("ftin")
                setInchesRaw(e.target.value)
                if (source !== "ftin") setFeetRaw(breakdown ? String(breakdown.feetInches.feet) : "")
              }}
            />
            <span className="text-sm text-muted-foreground">in</span>
          </div>
        </div>

        <div className="rounded-md border bg-muted p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Result</p>
              <p className="text-2xl font-bold" aria-live="polite">
                {breakdown ? `${formatHeightNumber(breakdown.cm, 1)} cm · ${formatFeetInches(breakdown.feetInches)}` : ""}
              </p>
              {breakdown ? <p className="text-sm text-muted-foreground">{formatHeightNumber(breakdown.m, 3)} m · {formatHeightNumber(breakdown.in, 1)} in total</p> : null}
            </div>
            <Button variant="ghost" size="icon" aria-label="Copy result" onClick={copy} disabled={!breakdown}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {outOfRange ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>This is outside the usual adult range. Check the unit, or ignore this note for infants and children.</span>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">1 inch = 2.54 cm exactly. Displayed values are rounded; the calculation is not.</p>
      </CardContent>
    </Card>
  )
}
