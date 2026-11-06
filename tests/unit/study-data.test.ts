import assert from "node:assert/strict";
import test from "node:test";
import { isManifest, isSection, validIndex } from "../../app/src/library-types";
import { coachCards, coachIndex, coachManifest } from "../coach-fixtures";

test("generated indexes reject coerced families, invalid metadata and duplicate identities", () => {
  assert.equal(validIndex(coachIndex), true);
  for (const change of [
    { family: ["eje"] },
    { family: { value: "eje" } },
    { level: "0" },
    { new_seconds: true },
    { objective: ["gravedad"] },
    { objective: "inventado" },
    { section_id: 1 },
  ])
    assert.equal(
      validIndex({ ...coachIndex, cards: [{ ...coachIndex.cards[0], ...change }] }),
      false,
    );
  assert.equal(
    validIndex({
      ...coachIndex,
      cards: [coachIndex.cards[0], { ...coachIndex.cards[0], order: 1 }],
    }),
    false,
  );
});

test("manifest downloads require a literal supported URL", () => {
  assert.equal(isManifest(coachManifest), true);
  assert.equal(
    isManifest({
      ...coachManifest,
      downloads: [{ ...coachManifest.downloads[0], url: ["enarm-eje.apkg"] }],
    }),
    false,
  );
});

test("coverage metadata rejects incorrect numeric and hash types", () => {
  const coverage = {
    sections: 1,
    required_sections: 35,
    scenarios: 5,
    section_hashes: { "01": "a".repeat(64) },
  };
  assert.equal(isManifest({ ...coachManifest, coverage }), true);
  for (const change of [
    { sections: "1" },
    { required_sections: false },
    { scenarios: [] },
    { section_hashes: ["a"] },
  ])
    assert.equal(isManifest({ ...coachManifest, coverage: { ...coverage, ...change } }), false);
});

test("section cards must belong to their section and declared blocks", () => {
  const section = {
    id: "01",
    title: "Sección de prueba",
    blocks: [{ id: "01.01", title: "Bloque", topics: 1 }],
    cards: coachCards,
  };
  assert.equal(isSection(section), true);
  for (const change of [
    { section_id: "02" },
    { block_id: "01.99" },
    { objective: ["gravedad"] },
    { related_sections: [2] },
  ])
    assert.equal(isSection({ ...section, cards: [{ ...coachCards[0], ...change }] }), false);
});
