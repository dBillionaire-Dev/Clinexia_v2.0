// Browser helper for the account pages: JSON in, JSON out, readable errors.
export async function api<T = any>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: (typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.") + (typeof data?.hint === "string" ? ` (${data.hint})` : ""), status: res.status }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: "You appear to be offline. Please check your connection.", status: 0 }
  }
}
