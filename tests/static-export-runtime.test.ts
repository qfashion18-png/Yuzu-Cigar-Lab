import assert from "node:assert/strict";
import test from "node:test";

import { getRouteCandidates, parseArgs } from "../scripts/static-preview.mjs";

test("production static preview serves the exported app shell at root", () => {
  assert.deepEqual(getRouteCandidates("/"), ["index.html"]);
});

test("production static preview resolves trailing slash export routes", () => {
  assert.deepEqual(getRouteCandidates("/account/"), ["account/", "account/.html", "account/index.html"]);
  assert.deepEqual(getRouteCandidates("/shop/ashton-churchill-25-bx/"), [
    "shop/ashton-churchill-25-bx/",
    "shop/ashton-churchill-25-bx/.html",
    "shop/ashton-churchill-25-bx/index.html",
  ]);
});

test("production static preview keeps assets as direct file requests", () => {
  assert.deepEqual(getRouteCandidates("/_next/static/chunks/app.js"), ["_next/static/chunks/app.js"]);
  assert.deepEqual(getRouteCandidates("/../package.json"), []);
});

test("production static preview parses npm start port arguments", () => {
  assert.deepEqual(parseArgs(["out", "-l", "4175"]), {
    directory: "out",
    host: "0.0.0.0",
    port: 4175,
  });
});
