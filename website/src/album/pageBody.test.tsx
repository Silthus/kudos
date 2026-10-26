import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

function loadSheets(...files: string[]) {
  for (const file of files) {
    const style = document.createElement("style");
    style.textContent = readFileSync(join(__dirname, file), "utf8");
    document.head.append(style);
  }
}

function pageBodyStyleOf(page: string) {
  const body = document.createElement("article");
  body.className = `al-page-body ${page}`;
  document.body.append(body);
  return getComputedStyle(body);
}

describe("each page's own layout wins over the shared page body, whatever order the bundle loads them in", () => {
  it.each([
    ["al-pp", "playerPage.css", "1024px"],
    ["al-ms", "milestones.css", "1080px"],
    ["al-team-page", "team.css", "960px"],
  ])("%s keeps the width from %s with album.css loaded after it", (page, sheet, maxWidth) => {
    loadSheets(sheet, "album.css");

    expect(pageBodyStyleOf(page).maxWidth).toBe(maxWidth);
  });

  it("page D stays a grid, so its card and rarest find can sit side by side", () => {
    loadSheets("playerPage.css", "album.css");

    expect(pageBodyStyleOf("al-pp").display).toBe("grid");
  });
});
