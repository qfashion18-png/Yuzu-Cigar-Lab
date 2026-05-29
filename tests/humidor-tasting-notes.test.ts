import assert from "node:assert/strict";
import test from "node:test";

import { formatHumidorTastingNote } from "../src/lib/humidor-tasting-notes";

test("formats AI-pulled cigar details into readable keyed tasting note sections", () => {
  const formatted = formatHumidorTastingNote(
    "This is a medium-bodied cigar with a likely flavor profile of earthy, spicy, and woody notes. It is recommended to age this cigar for optimal flavor development. Pulled cigar details: - Manufacturer: Tabacalera Cubana S.A. - Country: Cuba - Region: Cuba - Factory: Tabacalera Cubana S.A. - Size: Pierre Estel - Length: Unknown - Ring gauge: Unknown - Flavor Profile: Earthy, spicy, woody - Body: Medium - Source summary: Details inferred from known cigar references and visible band/label information.",
  );

  assert.deepEqual(formatted.paragraphs, [
    "This is a medium-bodied cigar with a likely flavor profile of earthy, spicy, and woody notes. It is recommended to age this cigar for optimal flavor development.",
  ]);
  assert.deepEqual(formatted.details.slice(0, 4), [
    { label: "Manufacturer", value: "Tabacalera Cubana S.A." },
    { label: "Country", value: "Cuba" },
    { label: "Region", value: "Cuba" },
    { label: "Factory", value: "Tabacalera Cubana S.A." },
  ]);
  assert.deepEqual(formatted.details.find((detail) => detail.label === "Flavor Profile"), {
    label: "Flavor Profile",
    value: "Earthy, spicy, woody",
  });
  assert.equal(
    formatted.details.find((detail) => detail.label === "Source summary")?.value,
    "Details inferred from known cigar references and visible band/label information.",
  );
});

test("preserves plain member tasting notes as paragraphs", () => {
  const formatted = formatHumidorTastingNote("First third: cedar and cocoa.\n\nFinal third: pepper picks up.");

  assert.deepEqual(formatted.paragraphs, ["First third: cedar and cocoa.", "Final third: pepper picks up."]);
  assert.deepEqual(formatted.details, []);
});
