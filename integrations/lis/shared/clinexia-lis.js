/*
 * clinexia-lis.js: HL7 v2 ORU^R01 helpers and the "add calculated results" logic, in plain ES5.
 *
 * REFERENCE EXAMPLE, NOT PRODUCTION SOFTWARE. The laboratory must validate it against its own methods and SOPs. Clinexia does not
 * replace LIS validation. See integrations/lis/README.md.
 *
 * One file, two homes: Node (require it) and Mirth Connect (paste it into a Code Template Library; Mirth's Rhino engine needs ES5,
 * so no arrow functions, let/const, template strings or spread). The calculation itself is a BACKEND you pass in:
 *     backend.calculate(calculatorId, inputs) -> { ok: true, version, result: { value, unit, secondary: [{label, value}] }, warnings: [] }
 *                                              | { ok: false, reason, fields: [{id, code}] }
 * Node uses @clinexia/core directly (node/core-backend.mjs); Mirth calls the Clinexia API (mirth/clinexia-api-backend.js).
 *
 * PHI: this file never logs, stores or sends anything. It returns the new message and a report; what you do with them is up to the
 * caller (the Node CLI prints only counts and skip reasons).
 */
(function (root, factory) {
  var api = factory()
  if (typeof module === "object" && module.exports) module.exports = api
  else root.ClinexiaLis = api
})((function () { return this })(), function () {
  "use strict"

  var LOINC = "LN"
  var CALC_METHOD = "CALCULATED"

  // ------------------------------------------------------------------------------------------------ HL7 parsing
  function parseMessage(text) {
    var lines = String(text).replace(/\r\n/g, "\r").replace(/\n/g, "\r").split("\r")
    var segments = []
    var i
    for (i = 0; i < lines.length; i++) if (lines[i].length > 0) segments.push(lines[i])
    if (segments.length === 0 || segments[0].substring(0, 3) !== "MSH") throw new Error("Not an HL7 v2 message: it must start with MSH.")
    var fieldSep = segments[0].charAt(3)
    var encEnd = segments[0].indexOf(fieldSep, 4)
    var enc = segments[0].substring(4, encEnd < 0 ? segments[0].length : encEnd)
    var msg = { fieldSep: fieldSep, compSep: enc.charAt(0) || "^", repSep: enc.charAt(1) || "~", escape: enc.charAt(2) || "\\", subSep: enc.charAt(3) || "&", segments: [] }
    for (i = 0; i < segments.length; i++) {
      var raw = segments[i]
      var parts = raw.split(fieldSep)
      var name = parts[0]
      // MSH-1 is the field separator itself, so MSH fields are shifted by one to keep "field n" = fields[n] for every segment.
      var fields = name === "MSH" ? ["MSH", fieldSep].concat(parts.slice(1)) : parts
      msg.segments.push({ name: name, fields: fields, raw: raw })
    }
    return msg
  }

  function field(seg, n) {
    var v = seg.fields[n]
    return v === undefined ? "" : v
  }

  /** Component n (1-based) of the first repetition of a field. */
  function component(msg, value, n) {
    var first = String(value).split(msg.repSep)[0]
    var parts = first.split(msg.compSep)
    var v = parts[n - 1]
    return v === undefined ? "" : v
  }

  function unescapeText(msg, s) {
    var e = msg.escape
    if (s.indexOf(e) < 0) return s
    return s.replace(new RegExp("\\" + e + "([FSTRE])\\" + e, "g"), function (m, c) {
      return c === "F" ? msg.fieldSep : c === "S" ? msg.compSep : c === "T" ? msg.subSep : c === "R" ? msg.repSep : e
    })
  }

  function escapeText(s) {
    var out = ""
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i)
      out += c === "\\" ? "\\E\\" : c === "|" ? "\\F\\" : c === "^" ? "\\S\\" : c === "&" ? "\\T\\" : c === "~" ? "\\R\\" : c === "\r" || c === "\n" ? " " : c
    }
    return out
  }

  // ------------------------------------------------------------------------------------------------ dates
  function digits(s) {
    var m = /^(\d+)/.exec(String(s))
    return m ? m[1] : ""
  }
  /** HL7 date/time (YYYYMMDD[HHMM[SS]][+ZZZZ]) to { y, m, d } or null when there is no complete date. */
  function dateParts(dtm) {
    var d = digits(dtm)
    if (d.length < 8) return null
    var y = Number(d.substring(0, 4)), m = Number(d.substring(4, 6)), day = Number(d.substring(6, 8))
    if (m < 1 || m > 12 || day < 1 || day > 31) return null
    var dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return day > dim ? null : { y: y, m: m, d: day }
  }
  function ageOn(birth, on) {
    var age = on.y - birth.y
    if (on.m < birth.m || (on.m === birth.m && on.d < birth.d)) age--
    return age >= 0 && age <= 130 ? age : null
  }
  function pad(n, w) {
    var s = String(n)
    while (s.length < w) s = "0" + s
    return s
  }
  function timestamp(date) {
    return pad(date.getUTCFullYear(), 4) + pad(date.getUTCMonth() + 1, 2) + pad(date.getUTCDate(), 2) + pad(date.getUTCHours(), 2) + pad(date.getUTCMinutes(), 2) + pad(date.getUTCSeconds(), 2)
  }

  // ------------------------------------------------------------------------------------------------ the catalogue
  // Which results feed which calculator, and what comes out. LOINC codes here are UNVERIFIED (see FINDINGS.md): they are used to
  // find inputs, and as the ALTERNATE identifier of calculated results. Calculated results are identified by a LOCAL code (CLX-...).
  var CATALOG = [
    {
      calculator: "anion-gap",
      inputs: [
        { input: "na", loinc: "2951-2", required: true },
        { input: "cl", loinc: "2075-0", required: true },
        { input: "hco3", loinc: "1963-8", required: true },
        { input: "albumin", loinc: "1751-7", required: false },
      ],
      outputs: [
        { from: "primary", code: "CLX-AG", name: "Anion gap (calculated)", loinc: "33037-3", reportedAs: ["33037-3"] },
        { from: "Albumin-corrected AG", code: "CLX-AGALB", name: "Albumin-corrected anion gap (calculated)", reportedAs: [] },
      ],
    },
    {
      calculator: "corrected-calcium",
      inputs: [
        { input: "calcium", loinc: "17861-6", required: true },
        { input: "albumin", loinc: "1751-7", required: true },
      ],
      outputs: [{ from: "primary", code: "CLX-CCA", name: "Albumin-corrected calcium (calculated)", reportedAs: [] }],
    },
    {
      calculator: "ldl-friedewald",
      unitFromResults: true,
      inputs: [
        { input: "tc", loinc: "2093-3", required: true },
        { input: "hdl", loinc: "2085-9", required: true },
        { input: "tg", loinc: "2571-8", required: true },
      ],
      outputs: [{ from: "primary", code: "CLX-LDL", name: "LDL cholesterol, Friedewald (calculated)", loinc: "13457-7", reportedAs: ["13457-7"] }],
    },
    {
      calculator: "red-cell-indices",
      inputs: [
        { input: "hgb", loinc: "718-7", required: true },
        { input: "hct", loinc: "4544-3", required: true },
        { input: "rbc", loinc: "789-8", required: true },
      ],
      outputs: [
        { from: "primary", code: "CLX-MCV", name: "MCV (calculated)", loinc: "787-2", reportedAs: ["787-2"], unit: "fL" },
        { from: "MCH", code: "CLX-MCH", name: "MCH (calculated)", loinc: "785-6", reportedAs: ["785-6"], unit: "pg" },
        { from: "MCHC", code: "CLX-MCHC", name: "MCHC (calculated)", loinc: "786-4", reportedAs: ["786-4"], unit: "g/dL" },
      ],
    },
    {
      calculator: "egfr-ckd-epi",
      demographics: true,
      inputs: [{ input: "creatinine", loinc: "2160-0", required: true }],
      outputs: [{ from: "primary", code: "CLX-EGFR", name: "eGFR, CKD-EPI (calculated)", loinc: "98979-8", reportedAs: ["98979-8", "62238-1", "33914-3"], unit: "mL/min/{1.73_m2}" }],
    },
  ]

  // Units: what a LIS prints, to what the calculators and the unit converter understand. Equal quantities only.
  var UNIT_ALIASES = {
    "10*12/l": "10\u00b9\u00b2/L", "10^12/l": "10\u00b9\u00b2/L", "x10^12/l": "10\u00b9\u00b2/L", "10e12/l": "10\u00b9\u00b2/L", "t/l": "10\u00b9\u00b2/L", "tera/l": "10\u00b9\u00b2/L",
    "10*6/ul": "10\u00b9\u00b2/L", "10^6/ul": "10\u00b9\u00b2/L", "x10^6/ul": "10\u00b9\u00b2/L", "10e6/ul": "10\u00b9\u00b2/L", // 1 x 10^6/uL = 1 x 10^12/L
    "mmol/l": "mmol/L", "umol/l": "umol/L", "mg/dl": "mg/dL", "g/dl": "g/dL", "g/l": "g/L",
  }
  function lisUnit(raw) {
    var u = String(raw).replace(/^\s+|\s+$/g, "")
    if (u === "") return ""
    var key = u.toLowerCase().replace(/\s+/g, "").replace(/\u00b5|\u03bc/g, "u")
    return UNIT_ALIASES[key] || u
  }

  // ------------------------------------------------------------------------------------------------ extraction
  function codesOf(msg, obx) {
    var id = field(obx, 3)
    var out = []
    function add(code, sys) {
      if (code) out.push({ code: code, system: sys })
    }
    add(component(msg, id, 1), component(msg, id, 3))
    add(component(msg, id, 4), component(msg, id, 6))
    return out
  }

  function loincOf(msg, obx, localCodeMap) {
    var codes = codesOf(msg, obx)
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].system === LOINC) return codes[i].code
      if (localCodeMap && Object.prototype.hasOwnProperty.call(localCodeMap, codes[i].code)) return localCodeMap[codes[i].code]
    }
    return ""
  }

  /** Groups the message by order: each OBR with the OBX segments that follow it (and the ORC just before it, if any). */
  function groupOrders(msg) {
    var groups = []
    var current = null
    var pendingOrc = null
    for (var i = 0; i < msg.segments.length; i++) {
      var s = msg.segments[i]
      if (s.name === "ORC") pendingOrc = s
      else if (s.name === "OBR") {
        current = { orc: pendingOrc, obr: s, obx: [] }
        groups.push(current)
        pendingOrc = null
      } else if (s.name === "OBX") {
        if (!current) { current = { orc: null, obr: null, obx: [] }; groups.push(current) }
        current.obx.push(s)
      }
    }
    return groups
  }

  function orderIds(msg, group) {
    if (!group.obr) return { placer: "", filler: "" }
    return { placer: component(msg, field(group.obr, 2), 1), filler: component(msg, field(group.obr, 3), 1) }
  }

  var NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

  /**
   * Finds the inputs of one catalogue entry in one order. Returns { inputs, sources, time } or { skip: reason }.
   * Safety rules: same order only; final (or corrected) results only; numeric values only (no "<0.5"); a unit must be present;
   * two different values for one input, or inputs measured at different times, are never combined.
   */
  function collectInputs(msg, group, entry, opts) {
    var wanted = {}
    var k
    for (k = 0; k < entry.inputs.length; k++) wanted[entry.inputs[k].loinc] = entry.inputs[k]
    var found = {}
    var anyStatusSkip = false
    var present = 0
    for (var i = 0; i < group.obx.length; i++) {
      var obx = group.obx[i]
      var loinc = loincOf(msg, obx, opts.localCodeMap)
      if (!loinc || !wanted[loinc]) continue
      present++
      var spec = wanted[loinc]
      var status = field(obx, 11)
      if (opts.acceptStatuses.indexOf(status) < 0) { anyStatusSkip = true; continue }
      var value = component(msg, field(obx, 5), 1).replace(/^\s+|\s+$/g, "")
      if (!NUMBER.test(value)) return { skip: "non_numeric:" + spec.input }
      var unit = lisUnit(component(msg, field(obx, 6), 1))
      var time = digits(field(obx, 14))
      var prev = found[spec.input]
      if (prev) {
        if (prev.value !== value || prev.unit !== unit || prev.time !== time) return { skip: "multiple_values:" + spec.input }
        continue
      }
      found[spec.input] = { value: value, unit: unit, time: time, loinc: loinc, setId: field(obx, 1), valueType: field(obx, 2) }
    }
    if (present === 0) return { notApplicable: true } // none of this calculator's inputs are in the order: nothing to report
    var inputs = {}
    var sources = []
    var times = []
    for (k = 0; k < entry.inputs.length; k++) {
      var s = entry.inputs[k]
      var f = found[s.input]
      if (!f) {
        if (s.required) return { skip: (anyStatusSkip ? "status_not_final:" : "missing_input:") + s.input }
        continue
      }
      if (f.valueType !== "NM") return { skip: "value_type_not_numeric:" + s.input }
      if (f.unit === "") return { skip: "missing_unit:" + s.input }
      sources.push({ input: s.input, loinc: f.loinc, setId: f.setId, value: f.value, unit: f.unit })
      if (entry.unitFromResults) {
        // values are added below, once the shared unit has been checked
      } else if (f.unit === "L/L" && s.input === "hct") inputs[s.input] = { value: Number(f.value) * 100, unit: "%" } // fraction to percent
      else inputs[s.input] = { value: Number(f.value), unit: f.unit }
      if (f.time) times.push(f.time)
    }
    if (entry.unitFromResults) {
      var u0 = sources[0].unit
      for (k = 0; k < sources.length; k++) if (sources[k].unit !== u0) return { skip: "mixed_units" }
      if (u0 !== "mg/dL" && u0 !== "mmol/L") return { skip: "unit_not_supported:" + u0 }
      inputs.unit = u0
      for (k = 0; k < sources.length; k++) inputs[entry.inputs[k].input] = Number(sources[k].value)
    }
    for (k = 1; k < times.length; k++) if (times[k] !== times[0]) return { skip: "different_times" }
    return { inputs: inputs, sources: sources, time: times[0] || digits(group.obr ? field(group.obr, 7) : "") }
  }

  function demographics(msg, pid, time) {
    if (!pid) return { skip: "no_demographics" }
    var sexRaw = field(pid, 8)
    var sex = sexRaw === "M" ? "male" : sexRaw === "F" ? "female" : ""
    if (!sex) return { skip: "sex_not_m_or_f" }
    var birth = dateParts(component(msg, field(pid, 7), 1))
    var on = dateParts(time)
    if (!birth || !on) return { skip: "age_not_determinable" }
    var age = ageOn(birth, on)
    return age === null ? { skip: "age_not_determinable" } : { age: age, sex: sex }
  }

  /** Notes travel in a message that is usually plain ASCII: show the superscript unit as 10*12/L. */
  function asciiUnit(u) {
    return String(u).replace(/10\u00b9\u00b2/g, "10*12")
  }

  function numberFromDisplay(text) {
    var m = /^\s*([+-]?\d+(\.\d+)?)/.exec(String(text))
    return m ? Number(m[1]) : null
  }

  function pickOutput(res, spec) {
    var r = res.result
    if (spec.from === "primary") return { value: r.value, unit: spec.unit || r.unit }
    var sec = r.secondary || []
    for (var i = 0; i < sec.length; i++) {
      if (sec[i].label === spec.from) {
        var n = numberFromDisplay(sec[i].value)
        if (n === null) return null
        var u = String(sec[i].value).replace(/^\s*[+-]?\d+(\.\d+)?\s*/, "")
        return { value: n, unit: spec.unit || u }
      }
    }
    return null
  }

  // ------------------------------------------------------------------------------------------------ building the new message
  function segment(msg, parts) {
    return parts.join(msg.fieldSep)
  }

  function obxSegment(msg, setId, spec, out, time, resultStatus, producer) {
    var f = []
    for (var i = 0; i <= 17; i++) f.push("")
    var cs = msg.compSep
    var id = spec.code + cs + escapeText(spec.name) + cs + "L"
    if (spec.loinc) id += cs + spec.loinc + cs + escapeText(spec.name) + cs + LOINC
    f[1] = String(setId)
    f[2] = "NM"
    f[3] = id
    f[5] = String(out.value)
    f[6] = out.unit ? escapeText(out.unit) + cs + cs + "UCUM" : ""
    f[11] = resultStatus
    f[14] = time
    f[15] = producer
    f[17] = CALC_METHOD + cs + "Calculated value, not measured" + cs + "L"
    return "OBX" + msg.fieldSep + f.slice(1).join(msg.fieldSep)
  }

  function nteSegment(msg, n, text) {
    return "NTE" + msg.fieldSep + n + msg.fieldSep + "L" + msg.fieldSep + escapeText(text)
  }

  function alreadyReported(msg, group, spec, opts) {
    var codes = (spec.reportedAs || []).concat([spec.code])
    for (var i = 0; i < group.obx.length; i++) {
      var obx = group.obx[i]
      var l = loincOf(msg, obx, opts.localCodeMap)
      var c = codesOf(msg, obx)
      var j
      for (j = 0; j < codes.length; j++) {
        if (l === codes[j]) return obx
        for (var k = 0; k < c.length; k++) if (c[k].code === codes[j]) return obx
      }
    }
    return null
  }

  /**
   * deriveCalculatedResults(text, backend, options) -> { oru: string|null, report }
   * options: sendingApplication, sendingFacility, receivingApplication, receivingFacility, resultStatus ("P"), acceptStatuses (["F","C"]),
   *          compare (false), localCodeMap ({ localCode: loinc }), calculators (default: all), now (Date), controlId, producer
   */
  function deriveCalculatedResults(text, backend, options) {
    var o = options || {}
    var opts = {
      sendingApplication: o.sendingApplication || "CLINEXIA_CALC",
      sendingFacility: o.sendingFacility || "",
      receivingApplication: o.receivingApplication,
      receivingFacility: o.receivingFacility,
      resultStatus: o.resultStatus || "P",
      acceptStatuses: o.acceptStatuses || ["F", "C"],
      compare: o.compare === true,
      localCodeMap: o.localCodeMap || {},
      calculators: o.calculators || null,
      producer: o.producer || "CLINEXIA^Clinexia calculated results^L",
    }
    var report = { controlId: "", calculated: [], skipped: [], reconciliation: [], errors: [] }
    var msg = parseMessage(text)
    var msh = msg.segments[0]
    var mtype = field(msh, 9)
    if (component(msg, mtype, 1) !== "ORU" || component(msg, mtype, 2) !== "R01") {
      report.errors.push("not_oru_r01")
      return { oru: null, report: report }
    }
    if (field(msh, 3) === opts.sendingApplication) {
      report.errors.push("already_processed_by_this_adapter") // never feed our own output back through the channel
      return { oru: null, report: report }
    }
    var pid = null, pv1 = null
    for (var s = 0; s < msg.segments.length; s++) {
      if (msg.segments[s].name === "PID" && !pid) pid = msg.segments[s]
      if (msg.segments[s].name === "PV1" && !pv1) pv1 = msg.segments[s]
    }

    var outLines = []
    var groups = groupOrders(msg)
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g]
      var ids = orderIds(msg, group)
      var groupLines = []
      var setId = 0
      for (var e = 0; e < CATALOG.length; e++) {
        var entry = CATALOG[e]
        if (opts.calculators && opts.calculators.indexOf(entry.calculator) < 0) continue
        var skip = function (reason) { report.skipped.push({ order: ids, calculator: entry.calculator, reason: reason }) }

        var col = collectInputs(msg, group, entry, opts)
        if (col.notApplicable) continue
        if (col.skip) { skip(col.skip); continue }
        var inputs = col.inputs
        if (entry.demographics) {
          var dem = demographics(msg, pid, col.time)
          if (dem.skip) { skip(dem.skip); continue }
          inputs.age = dem.age
          inputs.sex = dem.sex
        }

        // Which outputs does the analyser/LIS already report? Those are never overwritten by a calculated value.
        var wanted = []
        var reportedInMessage = []
        for (var p = 0; p < entry.outputs.length; p++) {
          var rep = alreadyReported(msg, group, entry.outputs[p], opts)
          if (rep) reportedInMessage.push({ spec: entry.outputs[p], obx: rep })
          else wanted.push(entry.outputs[p])
        }
        for (p = 0; p < reportedInMessage.length; p++) skip("already_reported:" + reportedInMessage[p].spec.code)
        if (wanted.length === 0 && !opts.compare) continue

        var res
        try {
          res = backend.calculate(entry.calculator, inputs)
        } catch (err) {
          res = { ok: false, reason: "backend_error" } // never include the error text: it could repeat input values
        }
        if (!res.ok) {
          var fields = ""
          if (res.fields) for (var q = 0; q < res.fields.length; q++) fields += (q ? "," : "") + res.fields[q].id + "/" + res.fields[q].code
          skip((res.reason || "calculation_failed") + (fields ? ":" + fields : ""))
          continue
        }

        if (opts.compare) {
          for (p = 0; p < reportedInMessage.length; p++) {
            var mine = pickOutput(res, reportedInMessage[p].spec)
            var theirs = component(msg, field(reportedInMessage[p].obx, 5), 1)
            var theirUnit = lisUnit(component(msg, field(reportedInMessage[p].obx, 6), 1))
            if (!mine || !NUMBER.test(theirs)) continue
            var same = theirUnit === mine.unit
            var diff = same ? Math.round((mine.value - Number(theirs)) * 1e6) / 1e6 : null
            report.reconciliation.push({ order: ids, calculator: entry.calculator, code: reportedInMessage[p].spec.code, analyser: Number(theirs), analyserUnit: theirUnit, calculated: mine.value, calculatedUnit: mine.unit, difference: diff, unitsMatch: same })
          }
        }
        if (wanted.length === 0) continue

        var produced = []
        var inputsText = []
        for (p = 0; p < col.sources.length; p++) inputsText.push(col.sources[p].loinc + "=" + col.sources[p].value + " " + asciiUnit(col.sources[p].unit) + " (OBX-" + col.sources[p].setId + ")")
        if (entry.demographics) inputsText.push("age " + inputs.age + ", sex " + inputs.sex + " (PID)")
        for (p = 0; p < wanted.length; p++) {
          var out = pickOutput(res, wanted[p])
          if (!out) continue
          setId++
          groupLines.push(obxSegment(msg, setId, wanted[p], out, col.time, opts.resultStatus, opts.producer))
          var note = "Calculated by Clinexia (" + entry.calculator + " formula " + res.version + ") from " + inputsText.join("; ") + ". Not an analyser result: verify per laboratory SOP."
          if (res.warnings && res.warnings.length) note += " Warning: " + res.warnings.join(" ")
          groupLines.push(nteSegment(msg, 1, note))
          produced.push({ code: wanted[p].code, name: wanted[p].name, value: out.value, unit: out.unit })
        }
        if (produced.length) report.calculated.push({ order: ids, calculator: entry.calculator, version: res.version, outputs: produced, sources: col.sources })
      }
      if (groupLines.length) {
        if (group.orc) outLines.push(group.orc.raw)
        if (group.obr) outLines.push(group.obr.raw)
        for (var L = 0; L < groupLines.length; L++) outLines.push(groupLines[L])
      }
    }

    if (outLines.length === 0) return { oru: null, report: report }

    var now = o.now || new Date()
    var control = o.controlId || "CLX" + timestamp(now)
    report.controlId = control
    var cs = msg.compSep
    var mshOut = ["MSH", msg.compSep + msg.repSep + msg.escape + msg.subSep, escapeText(opts.sendingApplication), escapeText(opts.sendingFacility),
      opts.receivingApplication !== undefined ? escapeText(opts.receivingApplication) : field(msh, 3),
      opts.receivingFacility !== undefined ? escapeText(opts.receivingFacility) : field(msh, 4),
      timestamp(now), "", "ORU" + cs + "R01" + cs + "ORU_R01", control, field(msh, 11) || "P", field(msh, 12) || "2.5.1"]
    var lines = [segment(msg, mshOut)]
    if (pid) lines.push(pid.raw)
    if (pv1) lines.push(pv1.raw)
    return { oru: lines.concat(outLines).join("\r") + "\r", report: report }
  }

  return {
    CATALOG: CATALOG,
    parseMessage: parseMessage,
    field: field,
    component: component,
    unescapeText: unescapeText,
    escapeText: escapeText,
    lisUnit: lisUnit,
    asciiUnit: asciiUnit,
    dateParts: dateParts,
    ageOn: ageOn,
    deriveCalculatedResults: deriveCalculatedResults,
  }
})
