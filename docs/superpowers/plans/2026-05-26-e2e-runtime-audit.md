# E2E Runtime Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable E2E runtime audit for the built static export so broken routes, missing assets, bad static-preview behavior, and runtime HTML error markers fail before Amplify packaging.

**Architecture:** The audit runs after `npm run build`, serves the generated `out/` directory through the existing `scripts/static-preview.mjs` server, and probes the real HTTP surface instead of source files. It audits a curated launch-critical route set by default, can expand to every exported HTML route with `--full`, follows internal links discovered from audited pages, and verifies script, stylesheet, image, manifest, icon, media, and CSS `url(...)` references return HTTP 200.

**Tech Stack:** Next.js 16.2.6 static export, Node.js 20+ `fetch`, `tsx`, `node:test`, existing project static preview server.

---

## File Structure

- Create `scripts/e2e-runtime-audit.ts`
  - Owns argument parsing, route discovery, reference extraction, preview-server startup, route checks, asset checks, and text report output.
  - Exports pure helpers for node tests.
- Create `tests/e2e-runtime-audit.test.ts`
  - Covers helper behavior without starting a server or requiring a built `out/` directory.
- Modify `package.json`
  - Adds `e2e:runtime-audit` as `npm run build && tsx scripts/e2e-runtime-audit.ts`.
- Modify `docs/codex-worktree-tracking.md`
  - Records the local Next.js docs consulted, files changed, audit command, and results.

## Task 1: Helper Tests

**Files:**
- Create: `tests/e2e-runtime-audit.test.ts`
- Create: `scripts/e2e-runtime-audit.ts`

- [x] **Step 1: Write the failing helper tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCssUrlReferences,
  extractHtmlRuntimeReferences,
  isExternalReference,
  routeFromOutHtmlPath,
} from "../scripts/e2e-runtime-audit";

test("maps exported html files to static-preview routes", () => {
  assert.equal(routeFromOutHtmlPath("out", "out/index.html"), "/");
  assert.equal(routeFromOutHtmlPath("out", "out/shop/index.html"), "/shop/");
  assert.equal(routeFromOutHtmlPath("out", "out/shop/padron/index.html"), "/shop/padron/");
  assert.equal(routeFromOutHtmlPath("out", "out/404.html"), null);
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --import tsx --test tests\e2e-runtime-audit.test.ts`

Expected: FAIL with a module export error because `scripts/e2e-runtime-audit.ts` does not exist yet.

## Task 2: Runtime Audit Runner

**Files:**
- Create: `scripts/e2e-runtime-audit.ts`
- Test: `tests/e2e-runtime-audit.test.ts`

- [x] **Step 1: Implement the pure helpers**

```ts
export function isExternalReference(value: string) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu.test(value);
}

export function extractCssUrlReferences(css: string) {
  return [...css.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)'"]+))\)/giu)]
    .map((match) => (match[1] ?? match[2] ?? match[3] ?? "").trim())
    .filter((value) => value && !isExternalReference(value));
}
```

- [x] **Step 2: Implement the server-backed audit**

The runner must:

```ts
const server = await createStaticPreviewServer(options.outDir);
await listen(server, options.host, options.port);
const baseUrl = `http://${displayHost}:${address.port}`;
await auditRoutes(baseUrl, options.routes);
await auditReferences(baseUrl, discoveredReferences);
server.close();
```

- [x] **Step 3: Print a concise pass/fail report**

The report must include checked route count, followed-link count, checked asset count, warning count, and failure messages. Exit `1` when any route or asset fails.

- [x] **Step 4: Run the helper tests again**

Run: `node --import tsx --test tests\e2e-runtime-audit.test.ts`

Expected: PASS.

## Task 3: Package Script Wiring

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add the audit script**

```json
{
  "scripts": {
    "e2e:runtime-audit": "npm run build && tsx scripts/e2e-runtime-audit.ts"
  }
}
```

- [x] **Step 2: Verify package script discovery**

Run: `npm run`

Expected: output lists `e2e:runtime-audit`.

## Task 4: Verification And Ledger

**Files:**
- Modify: `docs/codex-worktree-tracking.md`

- [x] **Step 1: Run static and runtime checks**

Run:

```bash
node --import tsx --test tests\e2e-runtime-audit.test.ts
npx tsc --noEmit --pretty false
npm run lint
npm run e2e:runtime-audit
```

Expected: all commands pass. The audit should build the static export, serve `out/`, verify launch-critical routes, follow internal links found on those pages, and verify referenced local runtime assets.

- [x] **Step 2: Record the pass**

Append a dated ledger section naming:

- Local Next.js 16.2.6 docs read.
- New audit script and test files.
- Package script added.
- Verification commands and results.
