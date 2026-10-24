// Emails the people an organisation just created accounts for: a welcome with a link to choose their password.
import { generateRecoveryToken } from "./admin-users"
import { composeAccountCreatedEmail } from "./emails"
import { sendEmailBatch } from "./notify"

export async function emailNewPeople(input: { orgName: string; adminName: string; baseUrl: string; people: Array<{ email: string; name: string }> }): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  const ready: Array<{ email: string; message: { to: string; subject: string; text: string; html: string } }> = []
  for (const p of input.people) {
    try {
      const t = await generateRecoveryToken(p.email)
      if (!t) continue
      const link = `${input.baseUrl}/account/reset?token=${encodeURIComponent(t.tokenHash)}`
      const e = composeAccountCreatedEmail({ name: p.name, orgName: input.orgName, adminName: input.adminName, link, loginUrl: `${input.baseUrl}/login`, email: p.email })
      ready.push({ email: p.email, message: { to: p.email, ...e } })
    } catch { /* this person simply is not emailed; the administrator can send a password email from the directory */ }
  }
  const results = ready.length ? await sendEmailBatch(ready.map((r) => r.message)) : []
  ready.forEach((r, i) => { out[r.email] = results[i] === "sent" })
  for (const p of input.people) out[p.email] ??= false
  return out
}
