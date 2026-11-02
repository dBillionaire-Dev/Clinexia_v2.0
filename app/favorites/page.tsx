"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { AccessBadge } from "@/components/account/access-badge"
import { getFavorites, subscribeFavorites, toggleFavorite } from "@/lib/favorites"
import { getCalculatorById } from "@/lib/calculators/registry"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import { CollectionsManager } from "@/components/collections-manager" // clinexia-upgrade:phase1 collections

export default function FavoritesPage() {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    setIds(getFavorites())
    return subscribeFavorites(() => setIds(getFavorites()))
  }, [])

  const tools = ids.map((id) => getCalculatorById(id)).filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <PageContainer title="Favorites" description="Calculators and tools you've starred, stored locally on this device.">
      {tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No favorites yet. Tap the star on any calculator to pin it here.
        </p>
      ) : (
        <div className="grid gap-3">
          {tools.map((tool) => (
            <Card key={tool.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between gap-4 py-4">
                <Link href={`/calculators/${tool.category}/${tool.id}`} className="min-w-0">
                  <CardTitle className="text-base">{tool.name}<AccessBadge id={tool.id} category={tool.category} /></CardTitle>
                  <CardDescription className="mt-1">{tool.description}</CardDescription>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove from favorites"
                  onClick={() => {
                    toggleFavorite(tool.id)
                    setIds(getFavorites())
                  }}
                >
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      <CollectionsManager />
    </PageContainer>
  )
}
