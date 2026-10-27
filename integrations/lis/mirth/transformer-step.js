/*
 * Mirth Connect: transformer step that adds calculated results to an HL7 v2 ORU^R01. REFERENCE EXAMPLE, NOT PRODUCTION SOFTWARE.
 * The laboratory must validate it against its own methods and SOPs. Clinexia does not replace LIS validation.
 *
 * Setup (details in integrations/lis/README.md):
 *  1. Code Template Library: add shared/clinexia-lis.js and mirth/clinexia-api-backend.js (in that order) and make the library available to the channel.
 *  2. Configuration Map: CLINEXIA_API_BASE and CLINEXIA_API_KEY.
 *  3. Add this as a JavaScript step in the Source transformer (or a Destination transformer) of a channel whose inbound data type is HL7 v2.x.
 *  4. Add a destination that sends ${calculatedOru} to the LIS, with the filter:  channelMap.get('calculatedOru') != null
 *     Route the calculated message ONLY to the LIS or EMR, never back into this channel (the library also refuses messages it produced).
 *
 * The step puts the new message in the channel map as "calculatedOru" and only COUNTS in "calcSummary". Nothing is logged:
 * no values, no identifiers, no exception text.
 */
var rawMessage = String(connectorMessage.getRawData())
var backend = createClinexiaApiBackend(configurationMap.get("CLINEXIA_API_BASE"), configurationMap.get("CLINEXIA_API_KEY"), 5000)

var outcome = ClinexiaLis.deriveCalculatedResults(rawMessage, backend, {
  sendingApplication: "CLINEXIA_CALC",
  resultStatus: "P", // preliminary until your LIS or SOP releases the calculated values
})

if (outcome.oru) channelMap.put("calculatedOru", outcome.oru)
channelMap.put("calcSummary", '{"calculated":' + outcome.report.calculated.length + ',"skipped":' + outcome.report.skipped.length + ',"errors":' + outcome.report.errors.length + "}")
