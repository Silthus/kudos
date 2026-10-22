import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { settingsFixtures } from "./settingsFixtures";
import type { SettingsShown } from "./settingsRead";
import type { MySettings, PublicCelebrationsReply, ShellActions } from "./shell";
import { renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/settings");
});

async function showSettings(settings: MySettings, setPublicCelebrations?: ShellActions["setPublicCelebrations"]) {
  let shown: SettingsShown = settings;
  const view = await renderSettingsPage((asking) => (asking ? shown : undefined), { setPublicCelebrations });
  const showSettingsAnswer = (next: MySettings) => {
    shown = next;
    view.showSettingsAgain();
  };
  return { ...view, showSettingsAnswer };
}

function forTheMaintainer(publicCelebrations: boolean): MySettings {
  return { ...settingsFixtures.forTheMaintainer, publicCelebrations };
}

function publicCelebrationsSection() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Public celebrations" });
}

function theSwitch() {
  return within(publicCelebrationsSection()).getByRole("switch", { name: "Celebrate in the announcement channel" });
}

function status() {
  return within(publicCelebrationsSection()).getByRole("status");
}

describe("the maintainer switches public celebrations only through setPublicCelebrations", { timeout: 60_000 }, () => {
  it("leaves the section out while the read carries no switch, as for everyone but the maintainer", async () => {
    await showSettings(settingsFixtures.forTheMaintainer);

    expect(within(screen.getByRole("main")).queryByRole("region", { name: "Public celebrations" })).not.toBeInTheDocument();
  });

  it("says what it posts, and shows the switch as the read has it", async () => {
    await showSettings(forTheMaintainer(true));

    expect(publicCelebrationsSection()).toHaveTextContent("I celebrate teammates' progress in the announcement channel. Each teammate still hears about their own.");
    expect(theSwitch()).toBeChecked();
  });

  it("sends the switch once, holds it until it answers, and says so once the read shows it off", async () => {
    let answer: (reply: PublicCelebrationsReply) => void = () => undefined;
    const later = new Promise<PublicCelebrationsReply>((resolve) => (answer = resolve));
    const { user, actions, showSettingsAnswer } = await showSettings(forTheMaintainer(true), () => later);

    await user.click(theSwitch());
    await user.click(theSwitch());

    expect(actions.setPublicCelebrations).toHaveBeenCalledTimes(1);
    expect(actions.setPublicCelebrations).toHaveBeenCalledWith(false);
    expect(theSwitch()).toHaveAttribute("aria-disabled", "true");
    await act(async () => answer({ kind: "set" }));
    showSettingsAnswer(forTheMaintainer(false));
    expect(theSwitch()).not.toBeChecked();
    expect(status()).toHaveTextContent("Switched off. Nobody can pick public celebrations until they're switched on again.");
  });

  it("switches them on and says so", async () => {
    const { user, actions, showSettingsAnswer } = await showSettings(forTheMaintainer(false), async () => ({ kind: "set" }));

    await user.click(theSwitch());
    showSettingsAnswer(forTheMaintainer(true));

    expect(actions.setPublicCelebrations).toHaveBeenCalledWith(true);
    expect(status()).toHaveTextContent("Switched on. Teammates who chose them get them again.");
  });

  it("says when the switch was refused and leaves it as the read shows it", async () => {
    const { user } = await showSettings(forTheMaintainer(true), async () => ({ kind: "refused" }));

    await user.click(theSwitch());

    expect(theSwitch()).toBeChecked();
    expect(status()).toHaveTextContent("That couldn't be changed.");
  });

  it("has no accessibility violations", async () => {
    await showSettings(forTheMaintainer(false));

    const { violations } = await axe.run(publicCelebrationsSection());

    expect(violations).toEqual([]);
  });
});
