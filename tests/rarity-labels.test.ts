import { expect, test } from "vitest";
import { CATALOG, CATEGORY_LABEL } from "../convex/lib/messages";
import { CATEGORY_HINT, CATEGORY_LABEL as WEB_CATEGORY_LABEL } from "../src/lib/rarity";

test("the web app labels every message category the catalog has", () => {
  expect(WEB_CATEGORY_LABEL).toEqual(CATEGORY_LABEL);
  for (const t of CATALOG) expect(WEB_CATEGORY_LABEL[t.category]).toBeTruthy();
});

test("undiscovered Quest messages tell you how to find them", () => {
  expect(CATEGORY_HINT.quest_complete).toBe("Complete weekly quests to find these");
});
