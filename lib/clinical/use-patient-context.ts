"use client"
// clinexia-upgrade:phase2 — React binding for the patient context. Session storage only.

import { useCallback, useEffect, useMemo, useState } from "react"
import { createContextStore, type ContextState, type ContextStore } from "./patient-context"

const EVENT = "clinexia:patient-context-changed"

function browserStore(): ContextStore | null {
  if (typeof window === "undefined") return null
  try {
    return createContextStore(window.sessionStorage)
  } catch {
    return null
  }
}

export function usePatientContext() {
  const store = useMemo(browserStore, [])
  const [state, setState] = useState<ContextState | null>(null)
  const refresh = useCallback(() => setState(store ? store.load() : null), [store])

  useEffect(() => {
    refresh()
    window.addEventListener(EVENT, refresh)
    return () => window.removeEventListener(EVENT, refresh)
  }, [refresh])

  const announce = () => window.dispatchEvent(new Event(EVENT))
  return { store, state, available: store !== null, announce }
}
