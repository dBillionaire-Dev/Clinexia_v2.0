"use client"

/** A submit button that asks first (used for deleting a revenue entry). */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return <button type="submit" className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault() }}>{children}</button>
}
