import { createRequire } from "node:module"
import { createCoreBackend } from "./core-backend.mjs"

const require = createRequire(import.meta.url)
/** The shared ES5 module (also used by the Mirth example). */
export const lis = require("../shared/clinexia-lis.js")

/**
 * Adds calculated results to one HL7 v2 ORU^R01 message (text, segments separated by CR or LF).
 * Returns { oru, report }: `oru` is the new message with only the calculated OBX segments (null when there is nothing to add).
 * Nothing is logged or stored here.
 */
export function addCalculatedResults(core, messageText, options = {}) {
  return lis.deriveCalculatedResults(messageText, createCoreBackend(core), options)
}

/** A summary that is safe to print: counts and skip reasons only, no values and no identifiers. */
export function safeSummary(report) {
  const reasons = {}
  for (const s of report.skipped) reasons[`${s.calculator}: ${s.reason.split(":")[0]}${s.reason.includes(":") ? ":" + s.reason.split(":")[1] : ""}`] = (reasons[`${s.calculator}: ${s.reason.split(":")[0]}${s.reason.includes(":") ? ":" + s.reason.split(":")[1] : ""}`] ?? 0) + 1
  return { calculated: report.calculated.length, outputs: report.calculated.reduce((n, c) => n + c.outputs.length, 0), skipped: report.skipped.length, skipReasons: reasons, errors: report.errors }
}
