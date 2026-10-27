/*
 * Mirth Connect: Clinexia API backend for clinexia-lis.js. REFERENCE EXAMPLE, NOT PRODUCTION SOFTWARE.
 *
 * Paste into a Code Template Library (after clinexia-lis.js). Plain ES5 for Mirth's Rhino engine. Uses Java's HttpURLConnection, so it
 * needs no Mirth-specific HTTP helper.
 *
 * Configuration map keys (Settings > Configuration Map):
 *   CLINEXIA_API_BASE   e.g. https://clinexia.example.org   (no trailing path)
 *   CLINEXIA_API_KEY    an API key with the calculate:general scope (organisation owner or admin creates it; shown once)
 *
 * What is sent to the API: the numbers a formula needs (results, and for eGFR the age in years and sex). No names, no record
 * numbers, no dates of birth. If your policy forbids even that leaving your network, run the Node example (it calculates locally) or host the API yourself.
 * Nothing is logged here: no values, no messages, no exception text.
 */
function createClinexiaApiBackend(baseUrl, apiKey, timeoutMs) {
  var base = String(baseUrl).replace(/\/+$/, "")

  function post(path, bodyObject) {
    var url = new java.net.URL(base + path)
    var conn = url.openConnection()
    conn.setRequestMethod("POST")
    conn.setConnectTimeout(timeoutMs || 5000)
    conn.setReadTimeout(timeoutMs || 5000)
    conn.setRequestProperty("Authorization", "Bearer " + apiKey)
    conn.setRequestProperty("Content-Type", "application/json")
    conn.setDoOutput(true)
    var bytes = new java.lang.String(JSON.stringify(bodyObject)).getBytes("UTF-8")
    var os = conn.getOutputStream()
    os.write(bytes)
    os.close()
    var status = conn.getResponseCode()
    var stream = status >= 400 ? conn.getErrorStream() : conn.getInputStream()
    var text = ""
    if (stream) text = String(new java.util.Scanner(stream, "UTF-8").useDelimiter("\\A").next())
    return { status: Number(status), text: text }
  }

  return {
    name: "clinexia-api",
    calculate: function (calculatorId, inputs) {
      var reply
      try {
        reply = post("/api/v1/calculators/" + calculatorId + "/calculate", { inputs: inputs })
      } catch (e) {
        return { ok: false, reason: "network_error" }
      }
      var body
      try {
        body = JSON.parse(reply.text)
      } catch (e2) {
        return { ok: false, reason: "http_" + reply.status }
      }
      if (reply.status === 200 && body && body.result) {
        return { ok: true, version: body.version || "unversioned", result: body.result, warnings: body.result.warnings || [] }
      }
      if (reply.status === 422 && body && body.error) {
        var fields = []
        var src = body.error.fields || []
        for (var i = 0; i < src.length; i++) fields.push({ id: src[i].id, code: src[i].code })
        return { ok: false, reason: "invalid_input", fields: fields }
      }
      return { ok: false, reason: "http_" + reply.status }
    },
  }
}
