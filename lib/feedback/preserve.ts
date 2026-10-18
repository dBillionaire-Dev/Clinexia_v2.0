// A saved answer must never be erased by an older copy of the state. The popup stays mounted while someone fills in the form,
// so without this it could write its stale copy (no answer yet) over the answer the form had just recorded.
import type { FeedbackState } from "./schedule"

export function preserveCompletion(stored: unknown, next: FeedbackState): FeedbackState {
  if (!stored || typeof stored !== "object") return next
  const s = stored as Partial<FeedbackState>
  if (s.version !== next.version) return next // a different round is a fresh start
  return {
    ...next,
    doneAt: next.doneAt ?? (typeof s.doneAt === "number" ? s.doneAt : null),
    stoppedAt: next.stoppedAt ?? (typeof s.stoppedAt === "number" ? s.stoppedAt : null),
  }
}
