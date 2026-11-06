import { expect, test } from "@playwright/test";

test("the final layer-two build serves all 35 reviewed sections with more distinct scenarios", async ({
  request,
}) => {
  const manifest = await (await request.get("study/layers/capa2/manifest.json")).json();
  expect(manifest.review_status).toBe("cross-reviewed");
  expect(manifest.professional_review).toBe("pending");
  expect(manifest.sections).toHaveLength(35);
  expect(manifest.coverage.sections).toBe(35);
  expect(manifest.coverage.required_sections).toBe(35);
  const allIds = new Set<string>();
  for (const section of manifest.sections) {
    const data = await (await request.get(`study/layers/capa2/${section.url}`)).json();
    const original = await (await request.get(`study/${section.url}`)).json();
    const originalScenarios = original.blocks.reduce(
      (total: number, block: { topics: number }) => total + block.topics,
      0,
    );
    expect(data.cards.length).toBeGreaterThan(originalScenarios);
    expect(
      new Set(data.cards.map((card: { front: { text: string }[] }) => card.front[0].text)).size,
    ).toBe(data.cards.length);
    for (const card of data.cards) {
      expect(card.id.startsWith("capa2/")).toBe(true);
      expect(allIds.has(card.id)).toBe(false);
      allIds.add(card.id);
      expect(card.front.length).toBeGreaterThan(0);
      expect(card.sources.length).toBeGreaterThan(0);
      expect(card.corrections.length).toBeGreaterThan(0);
    }
  }
  expect(allIds.size).toBe(manifest.counts.cards);
});
