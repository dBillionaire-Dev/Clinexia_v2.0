/**
 * The only place the SMART flow uses browser storage, and only for two non-clinical choices (which calculator, embed or not).
 * Nothing about the patient is ever stored by Clinexia code. The OAuth library keeps its own session (tokens and the patient id)
 * in sessionStorage; clearFhirSession removes it as soon as the review is built.
 */
const OPTIONS_KEY = "clinexia.smart.options"

export interface SmartOptions { calculatorId: string; embed: boolean }

export function saveOptions(o: SmartOptions): void {
  try { window.sessionStorage.setItem(OPTIONS_KEY, JSON.stringify({ calculatorId: o.calculatorId, embed: o.embed })) } catch { /* storage may be blocked in an iframe */ }
}

export function loadOptions(): SmartOptions | null {
  try {
    const raw = window.sessionStorage.getItem(OPTIONS_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Partial<SmartOptions>
    return typeof o.calculatorId === "string" ? { calculatorId: o.calculatorId, embed: o.embed === true } : null
  } catch { return null }
}

/**
 * Removes our options and the OAuth library's session.
 * UNVERIFIED: fhirclient stores the current state id under the key "SMART_KEY" and the state itself under that id; this follows
 * its documented behaviour from memory. If the library changes, the session simply stays until the tab is closed.
 */
export function clearFhirSession(): void {
  try {
    const id = window.sessionStorage.getItem("SMART_KEY")
    if (id) window.sessionStorage.removeItem(id.replace(/^"|"$/g, ""))
    window.sessionStorage.removeItem("SMART_KEY")
    window.sessionStorage.removeItem(OPTIONS_KEY)
  } catch { /* nothing to clear */ }
}
