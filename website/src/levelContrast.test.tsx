import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedSettings, settingsFixtures } from "./settingsFixtures";
import { renderSettingsPage } from "./test/renderApp";
import { contrast, websiteDirectory, type Mode } from "./test/themeContrast";
import { fakeSystemTheme } from "./test/systemTheme";

const quillPrimitives = readFileSync(join(websiteDirectory, "node_modules", "@posthog", "quill", "dist", "primitives.css"), "utf8");

const darkModeRule = ":is(.dark,[theme=dark]) ";

function quillBackgroundToken(selector: string, inDarkMode: boolean) {
  const escaped = (inDarkMode ? darkModeRule + selector : selector).replace(/[.[\]():,]/g, (character) => `\\${character}`);
  const rule = new RegExp(`(?<=\\})${escaped}\\{[^}]*?background-color:var\\(--([\\w-]+)\\)`).exec(quillPrimitives);
  return rule?.[1];
}

function quillSwitchPaint(mode: Mode, state: "checked" | "unchecked", part: "" | " .quill-switch__thumb") {
  const selector = `.quill-switch[data-${state}]${part}`;
  const token = (mode === "dark" ? quillBackgroundToken(selector, true) : undefined) ?? quillBackgroundToken(selector, false) ?? (part === "" ? undefined : quillBackgroundToken(".quill-switch__thumb", false));
  if (token === undefined) throw new Error(`${selector} sets no background token in ${mode}`);
  return token;
}

async function switchedOffPaints() {
  window.history.replaceState(null, "", "/settings");
  await renderSettingsPage(fixedSettings({ ...settingsFixtures.everything, board: { onTheBoards: false } }));
  const visibility = within(screen.getByRole("main")).getByRole("switch", { name: "Show me on the leaderboards" });
  const paint = (pattern: RegExp) => {
    const tokens = [...visibility.classList].flatMap((name) => pattern.exec(name)?.[1] ?? []);
    expect(tokens).toHaveLength(1);
    return tokens[0]!;
  };
  return { outline: paint(/^data-\[unchecked\]:border-((?:muted-)?foreground)$/), thumb: paint(/^data-\[unchecked\]:\[&_\[data-slot=switch-thumb\]\]:bg-((?:muted-)?foreground)$/), focus: paint(/^focus-visible:outline-((?:muted-)?foreground)$/) };
}

describe("WS339 V24: the visibility switch shows its position at 3:1 in both modes", () => {
  beforeEach(() => {
    fakeSystemTheme(false);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`in ${mode}`, async () => {
      const switchedOff = await switchedOffPaints();
      const offTrack = quillSwitchPaint(mode, "unchecked", "");
      const onTrack = quillSwitchPaint(mode, "checked", "");
      const measured = [
        { part: "the switched-off outline on the card", ratio: contrast(mode, switchedOff.outline, "card") },
        { part: "the switched-off thumb on its track", ratio: contrast(mode, switchedOff.thumb, offTrack) },
        { part: "the focus outline on the card", ratio: contrast(mode, switchedOff.focus, "card") },
        { part: "the switched-on track on the card", ratio: contrast(mode, onTrack, "card") },
        { part: "the switched-on thumb on its track", ratio: contrast(mode, quillSwitchPaint(mode, "checked", " .quill-switch__thumb"), onTrack) },
      ];
      expect(measured.filter(({ ratio }) => ratio < 3)).toEqual([]);
    });
  }
});
