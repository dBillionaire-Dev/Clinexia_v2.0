<!-- clinexia-upgrade:phase5 -->
# Business validation kit

Nothing here assumes demand. The aim is to find out, cheaply, whether a defined group of clinicians will change what they do
and whether anyone will pay. No prices or market sizes are stated because none were measured.

## 1. Hypotheses (write the evidence you accept before you start)

| # | Hypothesis | Evidence that supports it | Evidence that kills it |
|---|---|---|---|
| H1 | A named group (for example ICU nurses in two hospitals) has a repeated, time-pressured calculation task today done on paper, a spreadsheet or a general app. | 7 of 10 interviewees describe doing it at least weekly and name the tool they use now. | Fewer than 3 of 10 do it weekly. |
| H2 | Our guided scoring and offline reliability remove a real pain (errors, delay, no signal). | They describe a specific past error/near-miss or lost signal. | They say current tools are "fine". |
| H3 | An institution, not the individual, would pay (needs governance, audit, EMR launch). | A named budget holder agrees to a paid pilot or a formal evaluation. | Only "nice to have" praise. |
| H4 | Trust: they will use a tool only if sources and review are visible. | They open the "About this result" panel and ask who reviewed it. | They never look. |

## 2. Interview guide (30 minutes, no demo for the first 15)

1. Walk me through the last time you needed to calculate a score or dose at work. What did you use? What happened?
2. What went wrong, or nearly did? How often?
3. What would you need to see before you trusted a calculator you did not build?
4. Who decides which tools staff may use? Who pays for them? When did they last buy one, and why?
5. (Then demo guided mode and the evidence panel.) What would stop you using this tomorrow?
6. Who else should I speak to?

Record: role, setting, country, tool used today, frequency, what they would need for sign-off. Do not collect patient data.

## 3. Segments to test (pick one first)

Hospital ICU/ED nursing and pharmacy; clinical pharmacists; medical and nursing schools (education licence); small clinics with no EMR;
EMR vendors (embed/launch). Rank by: pain frequency, a buyer who exists, ability to reach 10 people in two weeks.

## 4. Pilot (only after H1 and H2 hold)

- 2 to 4 weeks, one unit, 10 to 20 clinicians, a named clinical champion.
- Agree the success measure in advance, for example: median time to complete CHA2DS2-VASc and HAS-BLED; calculation errors found in a sample audited by the champion; weekly active clinicians; staff trust (1 to 5) and why.
- Data: the app already avoids sending clinical values. Keep it so. Collect only usage counts, plus a short survey.
- Written agreement covers: not a medical device claim unless regulatory work has been done; clinical review sign-off record; incident contact.

## 5. Regulatory and liability questions to answer before any paid clinical deployment

- Is the intended use "decision support for clinicians" and does your jurisdiction classify it as a medical device (software as a medical device)?
- Who holds clinical responsibility for each tool's content? (The review register in `lib/clinical/review.ts` records this.)
- Terms of use, disclaimers, incident reporting, data protection impact assessment for any account/sync feature.
Take advice from a regulatory professional. This kit is not legal advice.

## 6. Metrics worth instrumenting (no patient data)

Tool opens, guided-mode starts and completions, Unknown-answer rate, "About this result" opens, offline sessions, update failures.
Add these as counts only, through the existing analytics path that already excludes clinical values.

## 7. Decision after 4 to 6 weeks

Continue, narrow the segment, change the product, or stop. Write down which hypotheses survived and the evidence.
