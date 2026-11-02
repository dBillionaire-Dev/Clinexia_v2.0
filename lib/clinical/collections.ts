// clinexia-upgrade:phase1 — user-defined collections of tools (for example "ICU Toolkit").
// A collection stores only a name and tool ids. No clinical values. The suggested names are only suggestions:
// the app does not decide which tools belong in a clinical collection.

export interface Collection {
  id: string
  name: string
  toolIds: string[]
  createdAt: string
}

export const COLLECTIONS_KEY = "clinexia:collections:v1"
export const MAX_COLLECTIONS = 12
export const MAX_NAME_LENGTH = 40
export const MAX_TOOLS_PER_COLLECTION = 60
export const SUGGESTED_NAMES = ["ICU Toolkit", "Emergency", "Pediatrics", "Laboratory"]

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type CollectionResult = { ok: true; collections: Collection[] } | { ok: false; message: string }

export function createCollectionStore(storage: StorageLike, clock: () => number = () => Date.now(), random: () => number = Math.random) {
  function list(): Collection[] {
    try {
      const parsed = JSON.parse(storage.getItem(COLLECTIONS_KEY) ?? "[]")
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (c): c is Collection => c && typeof c.id === "string" && typeof c.name === "string" && Array.isArray(c.toolIds),
      )
    } catch {
      return []
    }
  }
  const write = (collections: Collection[]): CollectionResult => {
    try {
      storage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
      return { ok: true, collections }
    } catch {
      return { ok: false, message: "Could not save. Storage may be full or blocked." }
    }
  }
  const cleanName = (name: string) => name.trim().replace(/\s+/g, " ")

  function create(rawName: string): CollectionResult {
    const name = cleanName(rawName)
    const all = list()
    if (!name) return { ok: false, message: "Give the collection a name." }
    if (name.length > MAX_NAME_LENGTH) return { ok: false, message: `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.` }
    if (all.length >= MAX_COLLECTIONS) return { ok: false, message: `You can keep up to ${MAX_COLLECTIONS} collections.` }
    if (all.some((c) => c.name.toLowerCase() === name.toLowerCase())) return { ok: false, message: "You already have a collection with that name." }
    const id = `col-${Math.floor(random() * 1e9).toString(36)}-${clock().toString(36)}`
    return write([...all, { id, name, toolIds: [], createdAt: new Date(clock()).toISOString() }])
  }

  function remove(id: string): CollectionResult {
    return write(list().filter((c) => c.id !== id))
  }

  function rename(id: string, rawName: string): CollectionResult {
    const name = cleanName(rawName)
    const all = list()
    if (!name || name.length > MAX_NAME_LENGTH) return { ok: false, message: `Use 1 to ${MAX_NAME_LENGTH} characters.` }
    if (all.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) return { ok: false, message: "You already have a collection with that name." }
    return write(all.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  function addTool(id: string, toolId: string): CollectionResult {
    const all = list()
    const target = all.find((c) => c.id === id)
    if (!target) return { ok: false, message: "Collection not found." }
    if (target.toolIds.includes(toolId)) return { ok: true, collections: all }
    if (target.toolIds.length >= MAX_TOOLS_PER_COLLECTION) return { ok: false, message: `A collection holds up to ${MAX_TOOLS_PER_COLLECTION} tools.` }
    return write(all.map((c) => (c.id === id ? { ...c, toolIds: [...c.toolIds, toolId] } : c)))
  }

  function removeTool(id: string, toolId: string): CollectionResult {
    return write(list().map((c) => (c.id === id ? { ...c, toolIds: c.toolIds.filter((t) => t !== toolId) } : c)))
  }

  return { list, create, remove, rename, addTool, removeTool }
}
