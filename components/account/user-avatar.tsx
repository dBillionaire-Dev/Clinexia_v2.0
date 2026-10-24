"use client"

import { useEffect, useState } from "react"

/** The person's photo, or their initial when there is none (or the photo cannot be loaded). */
export function UserAvatar({ url, initial, size = 28, fallbackClassName = "bg-primary text-primary-foreground" }: { url?: string | null; initial: string; size?: number; fallbackClassName?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])
  const box = { width: size, height: size }
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={box} className="shrink-0 rounded-full object-cover" />
  }
  return <span style={{ ...box, fontSize: Math.round(size * 0.43) }} className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${fallbackClassName}`}>{initial}</span>
}
