// A private message from the administrator to one person. It is saved first (so it shows inside the app and on the account page
// even if a phone or email problem occurs), then sent to their phones and to their email. Only that person can ever receive it.
import { getAuthUser } from "./admin-users"
import { db, uuid } from "./db"
import { composeAdminMessageEmail } from "./emails"
import { sendEmailMessage, type EmailResult } from "./notify"
import { parseServiceAccount, sendToDevices } from "../push/fcm"
import { createUserMessage, finishMessage, listTokensForUser, removeTokens } from "../push/store"

export interface MessageOutcome {
  id: string
  push: "sent" | "no_phones" | "not_configured" | "failed"
  phones: number
  email: EmailResult | "no_address"
}

export async function sendAdminMessage(input: { userId: string; title: string; body: string; baseUrl: string }): Promise<MessageOutcome | null> {
  const user = await getAuthUser(input.userId)
  if (!user) return null
  const id = await createUserMessage({ title: input.title, body: input.body, userId: input.userId })

  // Phone notification to the phones this person is signed in on.
  let push: MessageOutcome["push"] = "no_phones"
  let phones = 0
  try {
    const sa = parseServiceAccount(process.env.FCM_SERVICE_ACCOUNT_JSON)
    const tokens = await listTokensForUser(input.userId)
    if (tokens.length === 0) push = "no_phones"
    else if (!sa) push = "not_configured"
    else {
      const r = await sendToDevices(sa, tokens, { title: input.title, body: input.body, id })
      if (r.unregistered.length) await removeTokens(r.unregistered)
      await finishMessage(id, { sent: r.sent, failed: r.failed, removed: r.unregistered.length })
      phones = r.sent
      push = r.sent > 0 ? "sent" : "failed"
    }
  } catch {
    push = "failed"
  }

  // Email.
  let email: MessageOutcome["email"] = "no_address"
  if (user.email) {
    let name = ""
    try { name = String((await db.select("billing_profiles", `select=full_name&user_id=eq.${uuid(input.userId)}`))[0]?.full_name ?? "") } catch { /* name is optional */ }
    const e = composeAdminMessageEmail({ name, title: input.title, body: input.body, url: `${input.baseUrl}/account` })
    email = await sendEmailMessage({ to: user.email, ...e, idempotencyKey: `admin-msg:${id}` })
  }
  return { id, push, phones, email }
}
