# HANDOFF — 2026-10-13 (for the next Claude session)

John is moving to another terminal. This is where things stand. Everything
below is pushed to `origin/main` and deployed unless stated otherwise.
**Pull before doing anything** — he works from several machines.

## 1. THE LIVE TASK: import ~14,000 names as Weekly Mailer accounts

**What he asked for, verbatim in intent:** add the rows in
`P:\JAT Capital\South Shore Press\Master Distribution List Updated 10-11-26 election issue.xlsx`
to the Account Database as **Weekly Mailer** accounts, **appending** them.
**He explicitly does NOT want the existing Weekly Mailers overwritten.**

- In the import dialog that means **Append**, never **Replace & Import**
  (Replace clears every account of that type first).
- Account count before the import: **5,513** accounts total. Expect roughly
  19,500 after, and check the Weekly Mailer count specifically.

**THE BLOCKER — read this before retrying:** that .xlsx is **106.8 MB** for
~14k rows. That is 1000x what the data needs and is why the tab froze at
"Reading…" with Chrome's "Page Unresponsive" dialog. The parse now runs in a
Web Worker (commit `c493979`, deployed), so the page should stay responsive —
but a 107 MB workbook may still exhaust memory while SheetJS inflates it.

Recommended order:
1. Ask John to open the file in Excel and **Save As → CSV UTF-8**. A 14k-row
   CSV will be ~1–2 MB and imports in seconds. The dialog accepts .csv.
2. Only if he can't, try the .xlsx with the new worker build and watch for an
   out-of-memory crash of the worker (the dialog falls back to inline
   parsing, which WILL freeze the tab on a file this size — don't let it).
3. I never managed to read the file's header row: a local Node parse of it
   ran past 5 minutes without finishing (same cause). **Confirm the column
   headers before importing**, especially that the ZIP add-on column is
   present and named something like "Zip 4".

**ZIP+4 is already handled** (commit `edf1dfb`): a separate "Zip 4" / "ZIP+4" /
"Plus4" column is folded into the ZIP as `11968-5339`. Leading zeros are
padded back on both halves (6880 + 339 → `06880-0339`), "0"/"0000" counts as
no add-on, and a ZIP that already carries its add-on is left alone. The
accounts table stores `zip` as text and the UI renders the full value —
verified. After importing, spot-check one record with an add-on and one
without.

He asked me to run the import for him. I had not started it — I was still
fixing the freeze. Doing it through the UI with Chrome automation is fine
(he asked), but **confirm Append vs Replace with him before clicking**, and
do not import the 107 MB file blind.

## 2. WAITING ON JOHN: one SQL statement

Migration 051 (edit locks) is applied. **052 is not yet** — until he runs this
in the Supabase SQL editor, two of HIS OWN terminals can still both edit the
same page and overwrite each other (different people are already protected):

```sql
ALTER TABLE public.np_edit_locks
  ADD COLUMN IF NOT EXISTS session_id text;
```

Also untested live: the read-only banner itself. The test is two windows on
the same Election Coverage page; the second should show an amber banner with
fields and Save disabled. I couldn't test it without risking locking him out
of his own paper while he was travelling.

## 3. What shipped today (all deployed, Vercel green)

- `edf1dfb` — account import folds a separate "Zip 4" column into the ZIP.
- `c493979` — that import parses in a Web Worker so a big list can't freeze
  the tab (`lib/accounts/import-parse.ts` + `app/.../import-worker.ts`).
- `a53fd14` — previous/next page links in every Newspaper Creator editor
  (top-right of the header), and View / Print PDF on an Election Coverage
  page now renders ALL pages of the section, not just the one you opened.
- `0f66a93` — edit locks on every page editor; the board now labels election
  pages "Election voter guide — N races (page X of Y)" instead of the
  misleading "No content yet".
- `4627bea` — locks are per browser WINDOW, not per login (needs 052).
- `24afd9a` — the original edit lock for the Election Coverage section.

## 4. Background on the bug that started all this

The Election Coverage section is stored as ONE blob on the first election
page, and every election page edits it. Two terminals open = the later Save
Section silently overwrote the earlier one, with no error and nothing in the
logs. That's why John lost work. The locks exist to stop exactly this.

Publisher's rules for the locks, which he was explicit about:
- **No takeover button.** Whoever opened it keeps it.
- **No version stamp / no rejected saves** — redoing 100 edits is impossible.
- **An hour of idle before a claim expires**, so stepping away never costs
  you the page. Released immediately when the tab closes.

Free a stuck page by hand:
```sql
DELETE FROM public.np_edit_locks WHERE scope = 'election:election';
-- or scope = 'page:<page uuid>'
```

## 5. Working notes for this repo

- `npm install` first: the other terminal added `@vercel/analytics`, and
  `npx tsc --noEmit -p .` fails without it.
- Checks before pushing: `npx tsc --noEmit -p .` then
  `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npx next build`.
  There is no ESLint config, so lint can't gate the Vercel build.
- Deploy status: `gh api repos/jthalerJAT/south-shore-press/commits/<sha>/status`.
- Vercel logs: project `prj_S56YOc24p4cd2xx4Oif8lvOXpl7Y`, team
  `team_zkVISI9OeLigC59WKHJgpV6Y`. Runtime logs are retained ONE DAY — ask
  for a short window (`since: "30m"`) or the query 400s.
- The portal needs John's login, so verify UI work through Claude in Chrome
  (his real browser), not the in-app browser. Opening an EDITOR page there
  now claims an edit lock — close the tab when done so it's released.
- There are two coexisting issue wireframes (standard / election, migration
  050). The board shows the ACTIVE one; work in the other is invisible until
  toggled. The Election Issue is currently active.

**Delete this file once the import is done and 052 is applied.**
