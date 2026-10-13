import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { shellFixtures, type ShellFixture } from "./shell";
import { fakeSystemTheme } from "./test/systemTheme";

const pages: { name: string; path: string; shell: ShellFixture }[] = [
  { name: "closed", path: "/", shell: shellFixtures.closed },
  { name: "signed out", path: "/", shell: shellFixtures.signedOut },
  { name: "home", path: "/", shell: shellFixtures.member },
  { name: "not found", path: "/nowhere", shell: shellFixtures.member },
  { name: "error", path: "/", shell: shellFixtures.error },
];

describe("WS24: every page passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const page of pages) {
      it(`${page.name} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        window.history.replaceState(null, "", page.path);
        const { container } = render(<App shell={page.shell} />);
        const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });
    }
  }
});
