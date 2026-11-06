# guests (Իմ հյուրերը)

Guest lists for Armenian events, printed. Users build a list (typed, pasted, Excel/CSV, or a
photo read by Gemini), arrange it on a sheet and print one of three **kinds**: a seating board
(guests under their tables), a plain guest list, or place cards. Any paper size, 46 templates,
40 Armenian fonts, interface in hy (default) / ru / en. No account needed. Billing is planned,
not built (`docs/BILLING.md`). Built from `../cv-builder` — same stack, conventions, auth,
guest mode, PDF printing and deploy.

**Stack:** Next.js 16 · React 19 · TypeScript · Ant Design 6 · Tailwind 4 · Zustand (immer) ·
next-intl (hy/ru/en, cookie) · pnpm · Express 5 + Prisma 6 + PostgreSQL · Puppeteer (PDF) ·
`@google/genai` (photo import) · papaparse + read-excel-file (file import) · @dnd-kit (panel row sorting)

## Commands

```bash
pnpm install        # + Prisma generate; locally also creates missing env files, starts the
                    # Docker Postgres (:5010) if down, applies pending migrations, seeds.
                    # Skipped when CI / NODE_ENV=production / SKIP_DB_SETUP (scripts/postinstall.mjs)
pnpm db:up          # Postgres in Docker on :5010, by hand
pnpm dev            # web :7010 + api :9010
pnpm verify         # typecheck → typecheck:server → lint → test → build — run before calling anything done
pnpm test           # vitest (tests/unit)
pnpm fonts:css      # public/fonts/manifest.json -> public/fonts/sheet-fonts.css
pnpm build:api      # server/dist -> out/api, the standalone API release the deploy ships
pnpm env:base64 production | clip   # server/.env.production.local -> the ENV_API_BASE64 secret
```

Seeded test accounts (all `guests-dev-1234`): `docs/DEV_CREDS.md`.

The API's `dev` script is `node --watch-path=src --import tsx`, **not** `tsx watch` (see
cv-builder's notes: under `concurrently` on Windows `tsx watch` never starts the child).

## Path alias

`@<folder>/*` → `./src/<folder>/*` (not `@/`): `@helpers/sheetLayout`, `@store/lists/single/store`.
`@test/*` → `./tests/*`. One entry per `src/` folder in `tsconfig.json`, never a bare `@*`.

## Where things live

| Looking for | Go to |
|---|---|
| The document type | `src/store/lists/single/types.ts` — twin of `server/src/services/listDocument.ts` |
| Templates (palette, typography, table style, free/premium) | `src/constants/templates.ts`; decor in `src/components/sheet/sheet.css` under `.sht-<id>` |
| Sheet shapes (arch, oval, circle, hexagon, wavy…; place cards stay rectangles) | outlines + content region `src/helpers/sheetShape.ts` · each template's frame along an outline `src/constants/templateFrames.ts` · picker `components/templates/ShapePicker.tsx` (editor Template step; template page via `TemplateShape.tsx`) |
| Paper formats | `src/constants/paper.ts` |
| **Layout engine** (where every block sits, mm; text wrapping) | `src/helpers/sheetLayout.ts` · browser text metrics `src/helpers/measureText.ts` · re-layout when fonts load `src/hooks/useSheetLayout.ts` |
| "Fit to the page" (button at the first page's top-right corner): columns + text size, fewest pages, names whole | `src/helpers/fitSheet.ts` · store `fitToPage` · button in `EditorCanvas` page extras |
| The renderer (editor, previews, PDF) | `src/components/sheet/SheetDocument.tsx` + `sheet.css`; scaled previews `SheetPreview.tsx` |
| Editor interactions (drag, drop, snap, marquee, inline edit) | `src/components/editor/canvas/useCanvasInteraction.tsx`, given to the sheet through `SheetInteraction.tsx`; selection actions `SelectionBar.tsx`; keys `useCanvasShortcuts.ts` |
| Editor state, undo/redo | `src/store/lists/single/store.ts` · autosave `src/components/editor/useAutosave.ts` · chrome state `src/store/editorUi/store.ts` |
| Panels = the editor's steps, in order (`EDITOR_TABS`) | `src/components/editor/panels/` — Kind, Template (shape + template), Design, Guests (quick add, by-table view, rows sorted with @dnd-kit across tables), Layout, Paper. A new list starts with the sample wedding as its own, editable guests and opens at Kind (`newListDocument`, `markJustCreated`) |
| Reset buttons (top bar: all; tab header; section header) | what each scope puts back `src/helpers/designReset.ts` · button + confirm `src/components/editor/controls/ResetButton.tsx` · paper change maths `src/helpers/paperChange.ts` |
| "Leave this page?" while unsaved | `src/components/LeaveGuard.tsx` (tab close/reload, links, Back) · register with `useLeaveGuard` (`src/hooks/`) — the editor's autosave does |
| Print preview (fullscreen modal) | `src/components/editor/PreviewModal.tsx` |
| Import | `src/components/editor/import/` · parsing `src/helpers/guestImport.ts` · photo → `server/src/routes/ai.ts` → `services/guestReader.ts` (Gemini) |
| Guest drafts (localStorage) | `src/helpers/localDraft.ts` — imported on sign-in by `EditorShell` |
| PDF | `server/src/services/pdf.ts` prints the web's `/render` page (`src/app/render/`); the editor and dashboard only download it (`src/hooks/usePdfDownload.ts`, `PdfActions`) — no browser printing |
| Who may print what | `server/src/services/entitlement.ts`: only the free template (`memorial`, shown as “Classic”) unless paid; web twin `isPrintable` |
| Languages | `src/i18n/request.ts` (cookie `NEXT_LOCALE`, default hy) · `src/messages/{hy,ru,en}.json` · switcher `components/layout/LanguageSwitcher.tsx` |
| Auth (password + Google), guest key | as cv-builder: `server/src/routes/identity*.ts`, `lib/guest.ts`, `services/guestLists.ts` |
| CI/CD, production | `.github/workflows/{ci,deploy}.yml` · `docs/DEPLOYMENT.md` · `docs/PRODUCTION_SETUP.md` · `deployment/` |
| SEO | `src/helpers/metadata.ts`, `src/constants/seo.ts`, `src/linkedDataSchema/site.ts`, `src/app/{sitemap,robots}.ts`, `src/app/llms.txt/` |

## Architecture facts that are easy to get wrong

- **The layout is computed, not CSS-flowed.** `layoutSheet` places every block (header,
  footer, guest, table, card) in mm on fixed-size pages and wraps every text into lines with
  the real font's metrics; `SheetDocument` draws exactly that. A block's height therefore is its
  printed height. Change line height, paddings or table-style metrics in `sheetLayout.ts`
  (`LINE_HEIGHT`, `TABLE_STYLE_METRICS`), never only in CSS.
- **Layout needs the browser.** Measurement uses a canvas, so a sheet is laid out only on the
  client, and again whenever a font finishes loading. `SheetPreview` draws nothing on the
  server (a server estimate would not hydrate); `/render` lays out only after its fonts load
  and then sets `data-sheet-ready`, which the API waits for.
- **One renderer for everything.** The editor turns `SheetDocument` interactive by wrapping it
  in `SheetInteractionProvider`; sheet components never import the editor. Editor-only marks
  (page labels, snap guides, marquee) come in through `renderPageExtras`, which the PDF never
  passes.
- **Shapes print on rectangular paper.** `design.shape` outlines the sheet: the template's
  background and decor sit on `.sh-face`, clipped to the outline with a 1.5 mm bleed, outside
  is plain paper, and a dashed cut line runs along the edge. `layoutSheet` keeps every block
  inside the outline drawn at the margin (`shapeRegion`): the title drops into a curve until it
  has room, rows are centred in the room at their height, a block that cannot fit anywhere
  sets `overflow` (which "fit to page" rejects). A template's CSS frame is rectangular, so on a
  shaped sheet it is hidden and `TEMPLATE_FRAMES` redraws it along the outline — a new framed
  template needs an entry there. Rectangles keep the original code path.
- **Grid vs free.** In grid mode a drag reorders (guests or tables) and a name dropped on
  another table re-seats the guest. In free mode `layout.positions` pins blocks; a block never
  dragged keeps its grid place. Changing the grid (columns, gaps, cards) clears positions in
  grid mode; changing the paper scales them.
- **Resizing** is for tables only (the handle at a table's bottom-right corner); guests, cards,
  header and footer are moved by grabbing, not sized. It writes `layout.sizes[id]` in any
  mode: `w` re-wraps the text (capped at the column in a grid, at the sheet when free), `h` is
  a *least* height — `layoutSheet` never makes a block shorter than its text. Sizes saved on
  other blocks earlier still apply until reset. Place cards are sized in the Layout step
  (`cardWidth`/`cardHeight`, for all). Sizes are cleaned up wherever positions are, and scaled
  with the paper.
- **Sheet colours and typography are document data**, so hex values live in `templates.ts`,
  not `tokens.ts`. App-chrome colours live only in `tokens.ts`.
- **The API coerces, it does not reject**, every list write (`coerceContent`/`coerceDesign`):
  colours `#rrggbb`, fonts/templates/paper from the catalogue, ids short tokens, limits capped.
- **Twins, pinned by `tests/unit/server/twins.spec.ts`:** template ids and which are free,
  fonts, table styles, kinds, text roles, paper formats/sizes/limits, list limits, price,
  default title, guest cookie, error codes, server-built paths — and every template's design
  survives the server's coercion unchanged.
- **Interface language is a cookie, not a URL.** Pages are indexed in Armenian. Calls with an
  explicit locale (`getTranslations({ locale: 'hy' })`, used by static OG images and llms.txt)
  must stay explicit so those routes stay static. Legal pages are Armenian in every language.
- **A list is owned by an account or a guest key**, never both (CHECK constraint); every
  `/lists` route scopes by `listOwnerOf(req)`.
- **Server Components cannot import `@ant-design/icons`**: import from `@components/ui/icons`.
- **antd styles are unlayered and beat Tailwind utilities** — override antd's own
  `display`/`height`/`white-space` inline or on a wrapper. Hide or show an antd control at a
  breakpoint through a native wrapper (as `LanguageSwitcher` does), and use `ui/TileButton`, not
  an antd `Button`, for icon-over-label choices: antd's fixed height and `nowrap` make long
  Armenian labels overflow.
- **Three widths, checked:** phones (bottom bar + bottom-sheet panels, `< lg`), tablets (the
  same, wider sheet), desktop (side panel). Hover-only controls also show on touch
  (`pointer-coarse:`); row drag handles exist only for a fine pointer.

## Working rules

As cv-builder: named inline exports (default only where Next requires it), explicit types,
endpoints only in `src/api/<domain>/endpoints.ts`, stores `create<S & A>()(immer(combine(…)))`,
every async failure shown with translated copy, never a server message. Every new UI string
goes into all three message files.

## Env files

Never read or print `.env*` files except `*.env.example`. A missing env file is created by
copying its `.env.example`.
