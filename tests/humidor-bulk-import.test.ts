import assert from "node:assert/strict";
import test from "node:test";

import { canUseHumidorBulkImport, parseHumidorBulkImport } from "../src/lib/humidor-bulk-import";

test("humidor bulk import is available to Kisha Sensei and Daimyo only", () => {
  assert.equal(canUseHumidorBulkImport("Box Access Pass"), false);
  assert.equal(canUseHumidorBulkImport(null), false);
  assert.equal(canUseHumidorBulkImport("Kisha"), true);
  assert.equal(canUseHumidorBulkImport("Sensei"), true);
  assert.equal(canUseHumidorBulkImport("Daimyo"), true);
});

test("humidor bulk import parses a CSV header into live API item input", () => {
  const result = parseHumidorBulkImport(`name,brand,line,vitola,quantity,humidorLocation,rating,tastingNotes
"Padron 1964 Anniversary",Padron,1964,Principe,2,"Locker A",94,"Cocoa, cedar"
"Davidoff Signature No. 2",Davidoff,Signature,"No. 2",1,"Home Tray",90,"Creamy cedar"`);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.items.map((item) => ({
      name: item.name,
      brand: item.brand,
      line: item.line,
      vitola: item.vitola,
      quantity: item.quantity,
      humidorLocation: item.humidorLocation,
      rating: item.rating,
      tastingNotes: item.tastingNotes,
      source: item.source,
    })),
    [
      {
        name: "Padron 1964 Anniversary",
        brand: "Padron",
        line: "1964",
        vitola: "Principe",
        quantity: 2,
        humidorLocation: "Locker A",
        rating: 94,
        tastingNotes: "Cocoa, cedar",
        source: "member_bulk_import",
      },
      {
        name: "Davidoff Signature No. 2",
        brand: "Davidoff",
        line: "Signature",
        vitola: "No. 2",
        quantity: 1,
        humidorLocation: "Home Tray",
        rating: 90,
        tastingNotes: "Creamy cedar",
        source: "member_bulk_import",
      },
    ],
  );
});

test("humidor bulk import rejects rows without a cigar name or valid quantity", () => {
  const result = parseHumidorBulkImport(`name,brand,quantity
,Padron,2
Liga Privada T52,Drew Estate,0
Oliva Serie V,Oliva,3`);

  assert.deepEqual(result.items.map((item) => item.name), ["Oliva Serie V"]);
  assert.deepEqual(result.errors, [
    "Row 2 needs a cigar name.",
    "Row 3 quantity must be 1 or greater.",
  ]);
});
