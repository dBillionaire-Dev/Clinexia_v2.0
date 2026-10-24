# Embedding Clinexia calculators

Any calculator can be shown inside your own page, EMR panel or LIS screen with an `<iframe>`:

```
https://<clinexia-host>/embed/<category>/<calculator-id>
```

`<category>` and `<calculator-id>` are the same as in the normal URL: `/calculators/renal/creatinine-clearance` becomes
`/embed/renal/creatinine-clearance`.

The embed view has no header, footer, navigation, install banner, feedback prompt or update prompt. It always shows the
intended-use line and the standard calculation disclaimer.

## 1. Get your origin allowed (required)

Browsers refuse to show the embed inside a page whose origin is not allowlisted. Ask the Clinexia operator to add your
origin (for example `https://emr.hospital.org`, no path, no wildcard) either to the `EMBED_ALLOWED_ORIGINS` environment
variable or to the `embed_partners` table. The allowlist is cached for about a minute. Until then the embed can only be
framed by Clinexia itself.

## 2. Copy-paste snippets

Plain iframe:

```html
<iframe
  src="https://CLINEXIA_HOST/embed/renal/creatinine-clearance?theme=light"
  title="Creatinine clearance (Clinexia)"
  width="100%" height="640"
  style="border:0"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
```

Prefilled from your own record (values are validated; invalid or unknown ones are ignored; nothing is calculated until the
user presses Calculate, unless you add `&calculate=1`):

```html
<iframe src="https://CLINEXIA_HOST/embed/renal/creatinine-clearance?age=54&weight=70&creatinine=1.2&sex=male&theme=dark" ...></iframe>
```

Parameters:

| Param | Meaning |
|---|---|
| `<input id>` | Prefills that input. Ids are the calculator's input ids (`age`, `weight`, `creatinine`, `sex`, ...). Numbers must be plain decimals within the input's min/max; selects must match an option value; dates are `YYYY-MM-DD`. |
| `<input id>_unit` | Unit of the value, for example `creatinine=88&creatinine_unit=umol/L`. In this release only the input's own unit is accepted; other units are ignored until unit normalisation ships (Phase 2). |
| `calculate=1` | Run the calculation immediately after prefilling. Without it, never. |
| `theme=light\|dark` | Forces the theme. Without it the visitor's system theme is used. |
| `postMessage=1` | Turn on the postMessage bridge (below). |
| `parentOrigin=https://emr.hospital.org` | Optional hint of your origin. It is only honoured if it is allowlisted. The `Referer` origin is used otherwise. |

The same prefill parameters also work on the normal page, for example
`/calculators/renal/creatinine-clearance?age=54&weight=70&creatinine=1.2&sex=male`.

## 3. postMessage contract

Enabled with `?postMessage=1` and only when the parent origin is allowlisted. The embed never uses `"*"` as a target
origin, and it ignores messages from any other origin or window.

Embed to parent:

```js
{ source: "clinexia", type: "ready",  calculatorId: "creatinine-clearance" }
{ source: "clinexia", type: "result", calculatorId: "creatinine-clearance", version: "1.0.0", result: { value, unit, display, secondary, ... } }
```

`result` is the calculator's result object (`value`, `unit`, `display`, optional `secondary`, `calculationSteps`,
`interpretation`, `warnings`). `version` is the formula version (see the note below). Inputs are not included.

Parent to embed:

```js
iframe.contentWindow.postMessage(
  { type: "prefill", values: { age: 54, weight: 70, creatinine: 1.2, sex: "male" }, calculate: true },
  "https://CLINEXIA_HOST"   // always the exact embed origin, never "*"
)
```

Values are validated exactly like URL params. `calculate: true` is optional.

Host page example:

```js
const CLINEXIA = "https://CLINEXIA_HOST"
window.addEventListener("message", (e) => {
  if (e.origin !== CLINEXIA || e.data?.source !== "clinexia") return
  if (e.data.type === "ready") frame.contentWindow.postMessage({ type: "prefill", values: { age: 54 } }, CLINEXIA)
  if (e.data.type === "result") console.log(e.data.calculatorId, e.data.result.display)
})
```

Note: `version` is a placeholder `"1.0.0"` until the formula-version registry lands (Phase 3).

## 4. What the embed does and does not do with data

By design the embed does not write inputs or results to history, usage lists, analytics or any Clinexia server, and the
service worker does not cache `/embed` URLs. Calculation happens in the visitor's browser. See `no-phi-by-design.md`
(Phase 8). Check it yourself: open the browser's network tab while using an embed; you should see page and script loads
only, no requests carrying values.

## 5. Notes for the operator

* Framing: `next.config.mjs` keeps `frame-ancestors 'self'` (plus the landing domain) / `X-Frame-Options` on every route
  except `/embed`. `proxy.ts` sets `Content-Security-Policy: frame-ancestors 'self' <allowlist>` on `/embed` and removes
  `X-Frame-Options` there.
* Cross-Origin headers: production sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy:
  same-origin`. By specification neither governs whether a document may be shown in an iframe (COOP applies to top-level
  windows, CORP to subresource requests, and the embed loads its own scripts from its own origin). This is reasoned from
  the specs and has NOT been confirmed in a browser yet: test with the checklist below after deploying.
* Manual checklist: (1) from an allowlisted origin the iframe renders; (2) from any other origin the browser blocks it
  (console shows a frame-ancestors violation); (3) `/calculators/...` pages still cannot be framed by other sites;
  (4) the network tab shows no analytics calls while using the embed.
