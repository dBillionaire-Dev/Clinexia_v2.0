"use client"

import { badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CATEGORY_SPECIALTY, SPECIALTY_LABELS } from "@/lib/billing/config"
import { isPremiumCalculator } from "@/lib/billing/entitlements"
import { useAccountSession } from "@/lib/billing/use-account-session"
import type { CalculatorGroup } from "@/lib/calculators/types"

/**
 * Tells people at a glance what a tool needs: Free, or Premium for its specialty (which All-access also covers).
 * Shown only while premium locking is on; with it off every tool is free and a badge would be misleading.
 */
export function AccessBadge({ id, category, className }: { id: string; category: string; className?: string }) {
  const s = useAccountSession()
  if (!s.enforced || !(category in CATEGORY_SPECIALTY)) return null
  const group = category as CalculatorGroup

  if (!isPremiumCalculator({ id, category: group })) {
    return <span className={cn(badgeVariants({ variant: "secondary" }), "ml-2 align-middle text-[11px]", className)}>Free</span>
  }
  const specialty = CATEGORY_SPECIALTY[group]
  const label = SPECIALTY_LABELS[specialty]
  const unlocked = Boolean(s.entitlements && (s.entitlements.all || s.entitlements.specialties.includes(specialty)))
  return (
    <span
      title={`Included with ${label} premium and with All-access premium`}
      className={cn(badgeVariants({ variant: "outline" }), "ml-2 align-middle text-[11px]", unlocked ? "border-green-600/50 text-green-700 dark:text-green-400" : "border-amber-500/60 text-amber-700 dark:text-amber-400", className)}
    >
      {unlocked ? "Unlocked" : "Premium"} · {label}
    </span>
  )
}
