import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const siteHeaderSource = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");

test("mobile navigation selections close the site header sheet", () => {
  assert.ok(
    siteHeaderSource.includes("const [mobileMenuOpen, setMobileMenuOpen] = useState(false);"),
    "mobile menu should expose controlled open state"
  );
  assert.ok(
    siteHeaderSource.includes("<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>"),
    "mobile sheet should use controlled open state"
  );
  assert.ok(siteHeaderSource.includes("const closeMobileMenu = () => {"), "missing shared mobile menu close handler");

  const directCloseHandlers = siteHeaderSource.match(/onClick=\{closeMobileMenu\}/g) ?? [];
  assert.ok(directCloseHandlers.length >= 2, "mobile drawer links should close the sheet when selected");
  assert.ok(siteHeaderSource.includes("const handleMobileJoin = () => {"), "mobile join should close the sheet before opening signup");
  assert.ok(siteHeaderSource.includes("onClick={handleMobileJoin}"), "mobile join should use the shared signup opener");
  assert.ok(siteHeaderSource.includes("onClick={handleMobileSignOut}"), "mobile sign out should close the sheet too");
});
