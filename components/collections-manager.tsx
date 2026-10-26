"use client"
// clinexia-upgrade:phase1 — user-defined collections of tools (stored on this device; tool ids only).

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { getCalculatorById } from "@/lib/calculators/registry"
import { searchCalculators } from "@/lib/search"
import { MAX_NAME_LENGTH, SUGGESTED_NAMES, createCollectionStore, type Collection } from "@/lib/clinical/collections"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CollectionsManager() {
  const store = useMemo(() => (typeof window === "undefined" ? null : createCollectionStore(window.localStorage)), [])
  const [collections, setCollections] = useState<Collection[]>([])
  const [name, setName] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState<Record<string, string>>({})

  useEffect(() => { if (store) setCollections(store.list()) }, [store])
  if (!store) return null

  const apply = (result: { ok: true; collections: Collection[] } | { ok: false; message: string }) => {
    if (result.ok) { setCollections(result.collections); setMessage(null) } else setMessage(result.message)
    return result.ok
  }

  return (
    <section aria-labelledby="collections-heading" className="mt-10 space-y-4">
      <div>
        <h2 id="collections-heading" className="text-lg font-semibold">Collections</h2>
        <p className="text-sm text-muted-foreground">Group tools your own way, for example for a ward or a shift. Stored on this device only.</p>
      </div>

      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (apply(store.create(name))) setName("") }}>
        <label htmlFor="new-collection" className="sr-only">New collection name</label>
        <Input id="new-collection" value={name} maxLength={MAX_NAME_LENGTH} placeholder="New collection name" onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="outline">Create</Button>
        <span className="flex flex-wrap gap-1" aria-label="Name suggestions">
          {SUGGESTED_NAMES.map((s) => <Button key={s} type="button" size="sm" variant="ghost" onClick={() => setName(s)}>{s}</Button>)}
        </span>
      </form>
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}

      {collections.length === 0 ? <p className="text-sm text-muted-foreground">No collections yet.</p> : null}
      <div className="grid gap-3">
        {collections.map((c) => {
          const q = query[c.id] ?? ""
          const results = q.trim() ? searchCalculators(q).filter((t) => !c.toolIds.includes(t.id)).slice(0, 6) : []
          return (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Button type="button" size="sm" variant="ghost" aria-label={`Delete collection ${c.name}`} onClick={() => { if (window.confirm(`Delete the collection "${c.name}"? The tools themselves are not deleted.`)) apply(store.remove(c.id)) }}>Delete</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.toolIds.length === 0 ? <p className="text-sm text-muted-foreground">Empty. Search below to add tools.</p> : null}
                <ul className="flex flex-wrap gap-2">
                  {c.toolIds.map((id) => {
                    const tool = getCalculatorById(id)
                    return (
                      <li key={id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                        {tool ? <Link href={`/calculators/${tool.category}/${tool.id}`} className="hover:underline">{tool.shortName ?? tool.name}</Link> : <span className="text-muted-foreground">Unavailable tool</span>}
                        <button type="button" aria-label={`Remove ${tool?.name ?? id} from ${c.name}`} className="px-1 text-muted-foreground hover:text-foreground" onClick={() => apply(store.removeTool(c.id, id))}>×</button>
                      </li>
                    )
                  })}
                </ul>
                <div>
                  <label htmlFor={`add-${c.id}`} className="sr-only">Add a tool to {c.name}</label>
                  <Input id={`add-${c.id}`} value={q} placeholder="Add a tool: search by name or abbreviation" onChange={(e) => setQuery((s) => ({ ...s, [c.id]: e.target.value }))} className="max-w-sm" />
                  {results.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {results.map((t) => <li key={t.id}><Button type="button" size="sm" variant="outline" onClick={() => { if (apply(store.addTool(c.id, t.id))) setQuery((s) => ({ ...s, [c.id]: "" })) }}>Add {t.name}</Button></li>)}
                    </ul>
                  ) : q.trim() ? <p className="mt-2 text-sm text-muted-foreground">No matching tools.</p> : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
