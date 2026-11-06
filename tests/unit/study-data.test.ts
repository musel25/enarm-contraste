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
