# South Shore Press — InDesign Page Builder (UXP plugin)

A UXP panel for Adobe InDesign that pulls a page's content from the South Shore
Press editor portal and builds the InDesign page from a stored layout spec.
**Phase 7 scope: the Front Page (and Sports cover) — the "section cover" template.**

## What it does
1. Calls the portal's token-guarded print API (`/api/print/issue`, `/api/print/page/:id`).
2. Gets back the page's content data + a layout spec (frames in points + styles + bindings).
3. Creates a new 11×15 in InDesign document and lays out the logo, header
   (year/issue • tagline • date), hero photo + outlined headline + red "PAGE n"
   box + credit, the bottom tiles, and the banner. Photos are downloaded and placed.

## One-time portal setup
- Apply migration `db/migrations/010_print_templates.sql` in Supabase.
- In Vercel → Project → Settings → Environment Variables, set:
  - `INDESIGN_API_TOKEN` = a long random string (this is the token you paste into the plugin).
  - `SUPABASE_SERVICE_ROLE_KEY` must also be set (the API reads with it).
  - Redeploy so the new env vars take effect.

## Install the plugin (Windows)
1. Install **Adobe UXP Developer Tool (UDT)** from Creative Cloud Desktop (it's free).
2. Open InDesign (2023 / v18.5 or newer).
3. Open UDT → **Add Plugin** → select this folder's `manifest.json`.
4. On the plugin's row in UDT → **Load** (it loads into the running InDesign).
5. In InDesign: **Window → Extensions (or Plug-ins) → SSP Page Builder** to show the panel.

## Use it
1. In the panel, set **Portal URL** (default `https://south-shore-press.vercel.app`)
   and paste the **API token** (the `INDESIGN_API_TOKEN` value). Both are remembered.
2. Click **Load issue** → pick a page (only template pages — Front Page / Sports cover — appear).
3. Click **Build page** → a new InDesign document is created with the laid-out page.
4. Edit the page in the portal and click **Build page** again to regenerate.

## Notes & known limitations (first build)
- **Fonts are approximate.** The spec names fonts (Arial / Georgia); InDesign
  substitutes if a font isn't installed. We dial these toward the real
  `SS_1-8_DONNA.indd` styles in a later pass.
- **Front Page only** for now. Other page kinds get their own layout spec as we
  build them; the whole-issue "build everything" button is the next step (the
  API already lists every page).
- Network access is set to `all` in `manifest.json` for development (hero/tile
  photos come from arbitrary hosts). Tighten to specific domains before packaging.
- To distribute without UDT later, package the folder as a `.ccx` via UDT.

## Files
- `manifest.json` — plugin metadata, panel entrypoint, network permission.
- `index.html` — the panel UI.
- `main.js` — panel logic: fetch the API, drive the build.
- `lib/build-from-spec.js` — the interpreter: spec + data → InDesign frames.
