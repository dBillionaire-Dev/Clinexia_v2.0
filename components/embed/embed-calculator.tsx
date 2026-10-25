import { CalculatorRunner } from "@/components/calculators/calculator-runner"
import { CALCULATION_DISCLAIMER } from "@/lib/calculators/types"
import { INTENDED_USE_LINE } from "@/lib/integration/constants"
import type { EmbedConfig } from "@/lib/integration/embed-bridge"

/** Compact, chrome-free calculator for iframes. History, favourites, usage tracking and analytics are off in embed mode. */
export function EmbedCalculator({ calculatorId, embed }: { calculatorId: string; embed: EmbedConfig }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-2 text-sm sm:p-3" data-clinexia-embed>
      <CalculatorRunner calculatorId={calculatorId} embed={embed} />
      <footer className="space-y-1 border-t pt-2 text-[11px] leading-snug text-muted-foreground">
        <p>{INTENDED_USE_LINE}</p>
        <p>{CALCULATION_DISCLAIMER}</p>
        <p>Powered by Clinexia</p>
      </footer>
    </div>
  )
}
