/* Clinexia service worker  -  enables full offline use.
 *
 * Pre-caches configured routes and app assets, then caches successful
 * same-origin navigation responses and eligible runtime requests.
 *
 * Offline availability depends on successful precaching and whether the
 * required Next.js HTML, JavaScript chunks, styles, and data are cached.
 * Test the production build in airplane mode before claiming full offline
 * functionality.
 */

const CACHE_VERSION = "v6" // clinexia-upgrade:phase3 asset precache
const CACHE_PREFIX = "clinexia-"
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`

// Cache names owned by previous versions of this app.
const LEGACY_APP_CACHES = [
  "convertlab-shell-v5",
  "convertlab-runtime-v5",
]

const STATIC_ROUTES = [
  "/",
  "/calculators",
  "/calculators/hematology/red-cell-indices",
  "/conversions",
  "/conversions/mass-volume",
  "/conversions/molar-mass",
  "/estimators",
  "/favorites",
  "/history",
  "/lab-tools",
  "/lab-tools/dilution",
  "/lab-tools/microbiology",
  "/lab-tools/percentage-solution",
  "/lab-tools/serial-dilution",
  "/lab-tools/spectrophotometry",
  "/reference",
  "/settings",
  "/diagnostics",
]

const CALCULATOR_CATEGORIES = [
  "general",
  "renal",
  "chemistry",
  "hematology",
  "lab-solutions",
  "spectrophotometry",
  "microbiology",
  "dosing",
  "cardiovascular",
  "stem-cell-transplant",
  "oncology",
]

const CALCULATOR_ROUTES = [
  "/calculators/general/bmi",
  "/calculators/general/bsa",
  "/calculators/general/ideal-body-weight",
  "/calculators/general/bmr",
  "/calculators/general/adjusted-body-weight",
  "/calculators/general/estimated-calorie-requirement",
  "/calculators/general/waist-to-height-ratio",
  "/calculators/general/waist-to-hip-ratio",
  "/calculators/general/daily-water-intake",
  "/calculators/general/estimated-due-date",
  "/calculators/general/gestational-age",
  "/calculators/general/lean-body-mass",
  "/calculators/general/target-heart-rate",
  "/calculators/general/pack-years",
  "/calculators/general/alcohol-units",
  "/calculators/renal/creatinine-clearance",
  "/calculators/renal/egfr-ckd-epi",
  "/calculators/renal/bun-creatinine-ratio",
  "/calculators/renal/egfr-mdrd",
  "/calculators/renal/fena",
  "/calculators/renal/feurea",
  "/calculators/chemistry/ldl-friedewald",
  "/calculators/chemistry/non-hdl-cholesterol",
  "/calculators/chemistry/vldl-estimate",
  "/calculators/chemistry/anion-gap",
  "/calculators/chemistry/corrected-calcium",
  "/calculators/chemistry/total-hdl-ratio",
  "/calculators/chemistry/calcium-phosphate-product",
  "/calculators/chemistry/ldl-hdl-ratio",
  "/calculators/chemistry/delta-ratio",
  "/calculators/chemistry/estimated-osmolality",
  "/calculators/chemistry/hba1c-eag",
  "/calculators/chemistry/corrected-sodium-hyperglycemia",
  "/calculators/chemistry/bun-from-urea",
  "/calculators/chemistry/albumin-corrected-anion-gap",
  "/calculators/chemistry/creatinine-unit-conversion",
  "/calculators/hematology/red-cell-indices",
  "/calculators/hematology/absolute-cell-count",
  "/calculators/hematology/corrected-wbc",
  "/calculators/hematology/hematocrit-estimate",
  "/calculators/hematology/inr",
  "/calculators/hematology/corrected-count-increment",
  "/calculators/hematology/estimated-blood-volume",
  "/calculators/hematology/international-prognostic-index",
  "/calculators/hematology/reticulocyte-production-index",
  "/calculators/hematology/aptt-ratio",
  "/calculators/hematology/estimated-rbc-transfusion-volume",
  "/calculators/hematology/revised-international-prognostic-index",
  "/calculators/lab-solutions/molarity",
  "/calculators/lab-solutions/normality",
  "/calculators/lab-solutions/c1v1-c2v2-dilution",
  "/calculators/lab-solutions/percent-solution",
  "/calculators/lab-solutions/molarity-preparation",
  "/calculators/lab-solutions/reagent-dilution-volume",
  "/calculators/spectrophotometry/beer-lambert-law",
  "/calculators/spectrophotometry/absorbance-transmittance",
  "/calculators/spectrophotometry/spectro-standard-curve",
  "/calculators/spectrophotometry/spectro-dilution-corrected-concentration",
  "/calculators/spectrophotometry/spectro-wavelength-frequency",
  "/calculators/spectrophotometry/spectro-photon-energy",
  "/calculators/spectrophotometry/spectro-wavenumber",
  "/calculators/spectrophotometry/spectro-blank-corrected-absorbance",
  "/calculators/spectrophotometry/spectro-replicate-statistics",
  "/calculators/spectrophotometry/spectro-calibration-regression",
  "/calculators/spectrophotometry/spectro-photometric-linearity",
  "/calculators/microbiology/cfu-per-ml",
  "/calculators/microbiology/dilution-factor",
  "/calculators/microbiology/concentration-after-dilution",
  "/calculators/microbiology/serial-dilution-total-factor",
  "/calculators/microbiology/microbiology-concentration-dilution",
  "/calculators/microbiology/pooled-cfu-per-ml",
  "/calculators/dosing/mg-per-kg-dose",
  "/calculators/dosing/oral-liquid-dose-volume",
  "/calculators/dosing/tablet-capsule-count",
  "/calculators/dosing/dose-volume-rounding",
  "/calculators/dosing/mg-per-kg-per-day-dose",
  "/calculators/dosing/mg-per-m2-dose",
  "/calculators/dosing/dose-per-administration",
  "/calculators/dosing/dose-volume",
  "/calculators/dosing/drug-concentration",
  "/calculators/dosing/infusion-rate",
  "/calculators/dosing/drops-per-minute",
  "/calculators/dosing/maximum-dose-check",
  "/calculators/dosing/artesunate-severe-malaria",
  "/calculators/dosing/artemether-lumefantrine-uncomplicated-malaria",
  "/calculators/dosing/artesunate-amodiaquine-uncomplicated-malaria",
  "/calculators/dosing/artesunate-mefloquine-uncomplicated-malaria",
  "/calculators/dosing/dihydroartemisinin-piperaquine-uncomplicated-malaria",
  "/calculators/dosing/artesunate-sulfadoxine-pyrimethamine-uncomplicated-malaria",
  "/calculators/dosing/artesunate-pyronaridine-uncomplicated-malaria",
  "/calculators/dosing/amoxicillin-pediatric-dose",
  "/calculators/dosing/amoxicillin-clavulanate-pediatric-dose",
  "/calculators/dosing/azithromycin-pediatric-dose",
  "/calculators/dosing/ceftriaxone-pediatric-dose",
  "/calculators/dosing/cephalexin-pediatric-dose",
  "/calculators/dosing/metronidazole-pediatric-dose",
  "/calculators/dosing/cefuroxime-surgical-prophylaxis",
  "/calculators/dosing/ampicillin-pediatric-dose",
  "/calculators/dosing/cefotaxime-pediatric-dose",
  "/calculators/dosing/cloxacillin-pediatric-dose",
  "/calculators/dosing/ciprofloxacin-pediatric-dose",
  "/calculators/dosing/gentamicin-pediatric-dose",
  "/calculators/dosing/meropenem-pediatric-dose",
  "/calculators/dosing/vancomycin-pediatric-dose",
  "/calculators/dosing/amoxicillin-clavulanate-renal-adjustment",
  "/calculators/dosing/ciprofloxacin-renal-adjustment",
  "/calculators/dosing/cefotaxime-renal-adjustment",
  "/calculators/dosing/cefuroxime-axetil-renal-adjustment",
  "/calculators/dosing/meropenem-renal-adjustment",
  "/calculators/dosing/vancomycin-auc24-target-check",
  "/calculators/dosing/gentamicin-peak-trough-check",
  "/calculators/dosing/who-young-infant-sepsis-pneumonia",
  "/calculators/dosing/who-young-infant-meningitis",
  "/calculators/dosing/piperacillin-tazobactam-pediatric-dose",
  "/calculators/dosing/clindamycin-pediatric-dose",
  "/calculators/dosing/cefazolin-pediatric-dose",
  "/calculators/dosing/linezolid-pediatric-dose",
  "/calculators/dosing/doxycycline-pediatric-dose",
  "/calculators/dosing/loading-dose",
  "/calculators/dosing/maintenance-dose",
  "/calculators/dosing/infusion-duration",
  "/calculators/dosing/course-total-dose",
  "/calculators/dosing/who-pediatric-pneumonia-regimen",
  "/calculators/dosing/who-pediatric-diarrhoea-zinc",
  "/calculators/dosing/who-pediatric-ors-plan-b",
  "/calculators/dosing/who-pediatric-ors-ongoing-loss",
  "/calculators/dosing/who-pediatric-maintenance-fluid",
  "/calculators/dosing/pediatric-fluid-deficit",
  "/calculators/cardiovascular/mean-arterial-pressure",
  "/calculators/cardiovascular/ejection-fraction",
  "/calculators/cardiovascular/cha2ds2-vasc",
  "/calculators/cardiovascular/dapt-score",
  "/calculators/cardiovascular/qtc-correction",
  "/calculators/cardiovascular/atherogenic-index-plasma",
  "/calculators/cardiovascular/pulse-pressure",
  "/calculators/cardiovascular/cardiac-index",
  "/calculators/cardiovascular/has-bled",
  "/calculators/cardiovascular/af-ventricular-rate",
  "/calculators/general/qsofa", // clinexia-upgrade:phase4 routes (404 until approved: reported as skipped, not failed)
  "/calculators/general/sofa",
  "/calculators/general/pecarn-head-injury-under-2",
  "/calculators/general/pecarn-head-injury-2-to-17",
  "/calculators/chemistry/ldl-sampson",
  "/calculators/hematology/blood-volume-nadler-lemmens",
  "/calculators/stem-cell-transplant/hct-ci",
  "/calculators/stem-cell-transplant/conditioning-transplant-day",
  "/calculators/stem-cell-transplant/stem-cell-collection-yield",
  "/calculators/stem-cell-transplant/cd34-cell-dose",
  "/calculators/stem-cell-transplant/neutrophil-engraftment-day",
  "/calculators/stem-cell-transplant/donor-chimerism",
  "/calculators/stem-cell-transplant/stem-cell-collection-target",
  "/calculators/stem-cell-transplant/viable-cd34-cell-dose",
  "/calculators/stem-cell-transplant/engraftment-duration",
  "/calculators/oncology/oncology-bsa-dose",
  "/calculators/oncology/oncology-dose-intensity",
  "/calculators/oncology/oncology-relative-dose-intensity",
  "/calculators/oncology/oncology-cumulative-dose",
  "/calculators/oncology/oncology-cycle-total-dose",
  "/calculators/oncology/carboplatin-calvert-dose",
  "/calculators/oncology/oncology-dose-cap",
  "/calculators/oncology/oncology-regimen-dose",
  "/calculators/oncology/oncology-hematologic-dose-modification",
  "/calculators/oncology/oncology-organ-function-dose-modification",
  "/calculators/oncology/oncology-toxicity-safety",
  "/calculators/oncology/oncology-antiemetic-risk",
  "/calculators/oncology/oncology-febrile-neutropenia-risk",
  "/calculators/oncology/oncology-cycle-progress",
  "/calculators/oncology/oncology-course-completion",
]

const CONVERSION_CATEGORIES = [
  "mass",
  "volume",
  "length",
  "temperature",
  "pressure",
  "energy",
  "time",
  "concentration",
  "molar",
]

const ASSET_URLS = ["/manifest.webmanifest", "/favicon.ico", "/icon-192x192.png", "/icon-512x512.png"]

const PRECACHE_URLS = [
  ...STATIC_ROUTES,
  ...CALCULATOR_CATEGORIES.map((c) => `/calculators/${c}`),
  ...CALCULATOR_ROUTES,
  ...CONVERSION_CATEGORIES.map((c) => `/conversions/${c}`),
  ...ASSET_URLS,
]


// clinexia-upgrade:phase3 install
// Precache in three steps so an offline cold start works for pages that were never opened:
//   1. every configured page (HTML),
//   2. every /_next/static JS and CSS file those pages reference (found by reading the cached HTML),
//   3. any calculator pages linked from the category pages that are not in the configured list yet.
// Requests are limited to a few at a time. The outcome is stored at STATUS_URL so the app can say honestly
// whether the offline copy is complete. A 404 is "skipped" (the page does not exist in this build), not "failed".
const STATUS_URL = "/__precache-status.json"
const MAX_RUNTIME_ENTRIES = 600
const PRECACHE_CONCURRENCY = 6

function extractStaticAssets(html) {
  const found = new Set()
  const pattern = /(?:src|href)="(\/_next\/static\/[^"\s<>]+)"/g
  let match
  while ((match = pattern.exec(html)) !== null) found.add(match[1].replace(/&amp;/g, "&"))
  return [...found]
}

function extractCalculatorLinks(html) {
  const found = new Set()
  const pattern = /href="(\/calculators\/[a-z0-9-]+\/[a-z0-9-]+)"/g
  let match
  while ((match = pattern.exec(html)) !== null) found.add(match[1])
  return [...found]
}

async function runPool(items, limit, worker) {
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const item = items[next]
      next += 1
      try {
        await worker(item)
      } catch {
        // each worker records its own failure
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}

async function trimCache(cache, max) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i])
}

async function precacheOne(cache, url, report, found) {
  try {
    const response = await fetch(new Request(url, { cache: "reload", credentials: "same-origin" }))
    if (response.status === 404) {
      report.skipped.push(url)
      return
    }
    if (!isCacheableResponse(response)) {
      report.failed.push(url)
      return
    }
    const type = (response.headers && response.headers.get && response.headers.get("content-type")) || ""
    if (found && type.includes("text/html")) {
      const html = await response.clone().text()
      for (const asset of extractStaticAssets(html)) found.assets.add(asset)
      for (const link of extractCalculatorLinks(html)) found.pages.add(link)
    }
    await cache.put(url, response)
    report.cached += 1
  } catch {
    report.failed.push(url)
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      const report = { cached: 0, failed: [], skipped: [] }
      const found = { assets: new Set(), pages: new Set() }

      await runPool(PRECACHE_URLS, PRECACHE_CONCURRENCY, (url) => precacheOne(cache, url, report, found))

      const known = new Set(PRECACHE_URLS)
      const extraPages = [...found.pages].filter((url) => !known.has(url))
      await runPool(extraPages, PRECACHE_CONCURRENCY, (url) => precacheOne(cache, url, report, found))

      await runPool([...found.assets], PRECACHE_CONCURRENCY, (url) => precacheOne(cache, url, report, null))

      try {
        await cache.put(
          STATUS_URL,
          new Response(
            JSON.stringify({
              version: CACHE_VERSION,
              completedAt: new Date().toISOString(),
              cached: report.cached,
              failed: report.failed,
              skipped: report.skipped.length,
              assets: found.assets.size,
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        )
      } catch {
        // status is informational only
      }

      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()

      await Promise.all(
        cacheNames
          .filter((name) => {
            const isOldClinexiaCache =
              name.startsWith(CACHE_PREFIX) &&
              name !== SHELL_CACHE &&
              name !== RUNTIME_CACHE

            const isLegacyAppCache =
              LEGACY_APP_CACHES.includes(name)

            return isOldClinexiaCache || isLegacyAppCache
          })
          .map((name) => caches.delete(name)),
      )

      await self.clients.claim()
    })(),
  )
})


self.addEventListener("sync", (event) => {
  if (event.tag !== "convertlab-analytics") return
  event.waitUntil(syncAnalyticsFromServiceWorker())
})

function openAnalyticsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("convertlab", 2)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("history")) {
        const history = db.createObjectStore("history", { keyPath: "id" })
        history.createIndex("timestamp", "timestamp", { unique: false })
        history.createIndex("calculatorId", "calculatorId", { unique: false })
        history.createIndex("category", "category", { unique: false })
      }
      if (!db.objectStoreNames.contains("analytics_outbox")) {
        const outbox = db.createObjectStore("analytics_outbox", { keyPath: "id" })
        outbox.createIndex("occurredAt", "occurredAt", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getAnalyticsEvents() {
  const db = await openAnalyticsDB()
  const events = await new Promise((resolve, reject) => {
    const tx = db.transaction("analytics_outbox", "readonly")
    const request = tx.objectStore("analytics_outbox").getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return events
}

async function deleteAnalyticsEvents(ids) {
  if (!ids.length) return

  const db = await openAnalyticsDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction("analytics_outbox", "readwrite")
    const store = tx.objectStore("analytics_outbox")
    ids.forEach((id) => store.delete(id))
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function postAnalyticsBatch(batch) {
  return fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: batch.map((event) => ({
        ...event,
        source: event.source || "web",
        environment: event.environment || "production",
      })),
    }),
  })
}

// Returns true when every event in the batch was stored or permanently rejected.
async function syncAnalyticsBatch(batch) {
  const response = await postAnalyticsBatch(batch)

  if (response.ok) {
    const body = await response.json().catch(() => ({}))
    const finished = [...(body.accepted || []), ...(body.rejected || [])]
    await deleteAnalyticsEvents(finished)
    const done = new Set(finished)
    return batch.every((event) => done.has(event.id))
  }

  // The payload itself is bad: isolate the culprit so it cannot block the rest.
  if (response.status === 400 || response.status === 413 || response.status === 422) {
    if (batch.length > 1) {
      let allDone = true
      for (const event of batch) {
        if (!(await syncAnalyticsBatch([event]))) allDone = false
      }
      return allDone
    }
    await deleteAnalyticsEvents([batch[0].id])
    return true
  }

  return false
}

async function syncAnalyticsFromServiceWorker() {
  const events = await getAnalyticsEvents()
  if (!events.length) return

  for (let i = 0; i < events.length; i += 100) {
    let ok = false
    try {
      ok = await syncAnalyticsBatch(events.slice(i, i + 100))
    } catch {
      ok = false
    }
    // Throwing makes Background Sync retry later (with its own backoff).
    if (!ok) throw new Error("Clinexia analytics sync failed")
  }
}



function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin
}

function isCacheableResponse(response) {
  return Boolean(
    response &&
      response.ok &&
      response.type === "basic" &&
      new URL(response.url).origin === self.location.origin,
  )
}

async function cacheResponse(cacheName, request, response) {
  if (!isCacheableResponse(response)) return

  const cache = await caches.open(cacheName)
  await cache.put(request, response.clone())
  if (cacheName === RUNTIME_CACHE) await trimCache(cache, MAX_RUNTIME_ENTRIES) // clinexia-upgrade:phase3 trim
}

async function matchAppCache(request) {
  const shellCache = await caches.open(SHELL_CACHE)
  const runtimeCache = await caches.open(RUNTIME_CACHE)

  return (
    (await shellCache.match(request)) ||
    (await runtimeCache.match(request))
  )
}

async function handleNavigation(request) {
  const cached = await matchAppCache(request)

  if (cached) {
    // Return cached HTML immediately; refresh it in the background.
    void fetch(request)
      .then(async (response) => {
        if (isCacheableResponse(response)) {
          await cacheResponse(SHELL_CACHE, request, response)
        }
      })
      .catch(() => {})

    return cached
  }

  try {
    const response = await fetch(request)

    if (isCacheableResponse(response)) {
      await cacheResponse(RUNTIME_CACHE, request, response)
    }

    return response
  } catch {
    // clinexia-upgrade:phase3 offline-fallback: never answer another page's URL with the home page.
    return new Response(
      `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Clinexia offline</title>
        </head>
        <body>
          <h1>You are offline</h1>
          <p>This page is not available offline. Reconnect and try again.</p>
          <a href="/">Return to Clinexia</a>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    )
  }
}

async function handleAsset(request) {
  const url = new URL(request.url)

  // API responses should not be cached by this generic handler.
  if (url.pathname.startsWith("/api/")) {
    return fetch(request)
  }

  const cached = await matchAppCache(request)

  if (cached) return cached

  const response = await fetch(request)

  // Cache successful same-origin responses only.
  if (isCacheableResponse(response)) {
    await cacheResponse(RUNTIME_CACHE, request, response)
  }

  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (request.method !== "GET") return
  if (!isSameOrigin(request.url)) return

  // Integration URLs are never cached: /embed, and calculator or conversion links with a query string (prefill values can be
  // patient data and the cache key is the full URL). Offline use of the plain pages is unchanged.
  const requestUrl = new URL(request.url)
  if (requestUrl.pathname.startsWith("/embed/")) return
  if (request.mode === "navigate" && requestUrl.search && /^\/(calculators|conversions)(\/|$)/.test(requestUrl.pathname)) return

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request))
    return
  }

  event.respondWith(handleAsset(request))
})
