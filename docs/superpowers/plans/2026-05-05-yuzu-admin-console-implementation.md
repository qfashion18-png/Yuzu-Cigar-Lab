# Yuzu Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the requested end-to-end admin console surface with all operations modules plus a Website Editor for pages, images, fonts, colors, education stories, inventory, and members.

**Architecture:** Keep this first slice inside the existing Next.js app as a responsive client-side admin console backed by typed seed data and pure state helpers. The UI contracts are shaped so later backend work can swap local state for Medusa/Postgres/Secrets Manager APIs without changing the visual module model.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/base-ui primitives, lucide-react icons, Node test runner with tsx.

---

### Task 1: Admin Model And Tests

**Files:**
- Create: `src/lib/admin-console-model.ts`
- Create: `tests/admin-console-model.test.ts`
- Modify: `package.json`

- [ ] Add a `test` script using `node --import tsx --test tests/*.test.ts`.
- [ ] Write failing tests for `updateWebsiteTheme`, `updateInventoryStock`, `publishEducationStory`, `updateMemberTier`, and `summarizeAdminState`.
- [ ] Implement the typed seed state and helper functions.
- [ ] Run `npm test` and verify the model tests pass.

### Task 2: Admin Console Component

**Files:**
- Create: `src/components/admin/yuzu-admin-console.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] Build a client component with persistent module state and local data state from `createAdminSeedState`.
- [ ] Replace the current static admin page with `<YuzuAdminConsole />`.
- [ ] Preserve the screenshot style: Yuzu brand rail, gold active state, compact operations tables, and dark panel system.
- [ ] Implement modules: Overview, Website Editor, Catalog, Inventory, Orders, Compliance, Members, Subscriptions, Allocations, Humidor, Events, Credentials, Audit Log, Settings.
- [ ] Make all module controls update local state and write audit rows.

### Task 3: Website Editor Module

**Files:**
- Modify: `src/components/admin/yuzu-admin-console.tsx`
- Modify: `src/lib/admin-console-model.ts`
- Test: `tests/admin-console-model.test.ts`

- [ ] Add editor controls for homepage hero copy, CTA, selected image, font pairing, brand/accent colors, and education story publish state.
- [ ] Add desktop/tablet/mobile preview toggles.
- [ ] Add actions for publishing theme changes and story changes.
- [ ] Extend model tests for theme and story audit creation.

### Task 4: Responsive Verification And Build

**Files:**
- Modify: `src/components/admin/yuzu-admin-console.tsx`

- [ ] Ensure desktop uses sidebar plus multi-column workspaces.
- [ ] Ensure tablet collapses to wrapped controls and stacked detail panels.
- [ ] Ensure mobile uses horizontal module chips/cards with no horizontal page overflow.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Start the dev server and verify `/admin` visually at desktop, tablet, and mobile widths.

### Task 5: Documentation And Commit

**Files:**
- Modify: `docs/superpowers/specs/2026-05-05-yuzu-admin-platform-design.md`
- Create: `docs/superpowers/specs/assets/admin-sidebar-reference.png`

- [ ] Confirm the spec includes the Website Editor module and screenshot reference.
- [ ] Commit the implementation with tests and docs.
