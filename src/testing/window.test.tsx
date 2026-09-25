// @vitest-environment happy-dom
import { expect, test } from "vitest";
import { copyTells, viewportLayout } from "./window";

const html = (s: string) => {
  const div = document.createElement("div");
  div.innerHTML = s;
  return div;
};

test("viewport breakpoints are flagged inside a window, the window's own container breakpoints are not", () => {
  const root = html(`<div class="grid @lg:grid-cols-2"></div><div class="grid xl:grid-cols-4"></div><p class="max-sm:hidden"></p><p class="hover:underline"></p>`);
  expect(viewportLayout(root).map((el) => el.className)).toEqual(["grid xl:grid-cols-4", "max-sm:hidden"]);
});

test("middle dots, arrows and emoji are copy tells; allowed data like the kudos emoji is not", () => {
  const root = html(`<p>Used 2 of 5 · resets</p><a>Gallery →</a><span>Clean sweep 🧹</span><span>Ana sent you 1 🌮</span><span>Sep 1 – Sep 30</span>`);
  expect(copyTells(root, ["🌮"])).toEqual(["Used 2 of 5 · resets", "Gallery →", "Clean sweep 🧹"]);
});
