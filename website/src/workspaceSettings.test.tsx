import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { settingsFixtures, workspaceParts } from "./settingsFixtures";
import type { SettingsShown } from "./settingsRead";
import { type MySettings, type ShellActions, type WorkspaceSettingsPart, type WorkspaceSettingsReply } from "./shell";
import { renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/settings");
});

async function showSettings(settings: MySettings, setWorkspaceSettings?: ShellActions["setWorkspaceSettings"]) {
  let shown: SettingsShown = settings;
  const view = await renderSettingsPage((asking) => (asking ? shown : undefined), { setWorkspaceSettings });
  const showSettingsAnswer = (next: MySettings) => {
    shown = next;
    view.showSettingsAgain();
  };
  return { ...view, showSettingsAnswer };
}

function forTheMaintainer(workspace: WorkspaceSettingsPart = workspaceParts.defaults): MySettings {
  return { ...settingsFixtures.everything, workspace };
}

function answerLater() {
  let resolve: (answer: WorkspaceSettingsReply) => void = () => undefined;
  const answer = new Promise<WorkspaceSettingsReply>((settle) => {
    resolve = settle;
  });
  return { answer, resolve };
}

function workspaceSection() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Workspace" });
}

function field(name: string) {
  return within(workspaceSection()).getByRole(name === "Kudos emoji" ? "textbox" : "spinbutton", { name });
}

function saveButton() {
  return within(workspaceSection()).getByRole("button", { name: "Save" });
}

function status() {
  return within(workspaceSection()).getByRole("status");
}

describe("the maintainer's workspace settings change only through setWorkspaceSettings", { timeout: 60_000 }, () => {
  it("leaves the section out while the read carries no workspace part, as for everyone but the maintainer", async () => {
    await showSettings(settingsFixtures.everything);

    expect(within(screen.getByRole("main")).queryByRole("region", { name: "Workspace" })).not.toBeInTheDocument();
  });

  it("shows the daily allowance, the kudos emoji with its picture and the hug budget the read carries", async () => {
    await showSettings(forTheMaintainer(workspaceParts.customEmoji));

    expect(field("Kudos a day")).toHaveValue(3);
    expect(field("Kudos emoji")).toHaveValue("hoggo");
    expect(field("Hugs a day")).toHaveValue(10);
    expect(within(workspaceSection()).getByRole("img", { name: ":hoggo:" })).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/hoggo/1.png");
    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("previews a standard emoji as it is typed", async () => {
    const { user } = await showSettings(forTheMaintainer());

    await user.clear(field("Kudos emoji"));
    await user.type(field("Kudos emoji"), ":pizza:");

    expect(workspaceSection()).toHaveTextContent("🍕");
  });

  it("sends the three typed settings once, holds Save until it answers, and says so once the read shows them", async () => {
    const later = answerLater();
    const { user, actions, showSettingsAnswer } = await showSettings(forTheMaintainer(), () => later.answer);

    await user.clear(field("Kudos a day"));
    await user.type(field("Kudos a day"), "5");
    await user.clear(field("Kudos emoji"));
    await user.type(field("Kudos emoji"), ":pizza:");
    await user.clear(field("Hugs a day"));
    await user.type(field("Hugs a day"), "0");
    await user.click(saveButton());
    await user.click(saveButton());

    expect(actions.setWorkspaceSettings).toHaveBeenCalledExactlyOnceWith({ baseAllowance: 5, kudosEmoji: "pizza", hugBudget: 0 });
    expect(saveButton()).toHaveAttribute("aria-disabled", "true");

    await act(async () => later.resolve({ kind: "set" }));
    showSettingsAnswer(forTheMaintainer({ baseAllowance: 5, kudosEmoji: "pizza", kudosEmojiImage: null, hugBudget: 0 }));

    expect(await within(workspaceSection()).findByText("Saved. Every member gives and hugs by these from now on.")).toBeInTheDocument();
    expect(field("Kudos emoji")).toHaveValue("pizza");
  });

  it.each(["Kudos a day", "Hugs a day"])("holds Save while %s is empty, so a cleared field never saves as 0", async (name) => {
    const { user, actions } = await showSettings(forTheMaintainer(), async () => ({ kind: "set" }));

    await user.clear(field(name));
    await user.click(saveButton());
    await user.keyboard("{Enter}");

    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    expect(actions.setWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("holds every field while a save is in flight, so nothing typed then is lost when the read lands", async () => {
    const later = answerLater();
    const { user } = await showSettings(forTheMaintainer(), () => later.answer);

    await user.clear(field("Kudos a day"));
    await user.type(field("Kudos a day"), "5");
    await user.click(saveButton());

    for (const name of ["Kudos a day", "Kudos emoji", "Hugs a day"]) expect(field(name)).toHaveAttribute("readonly");
    await act(async () => later.resolve({ kind: "refused", reason: "allowance" }));
    for (const name of ["Kudos a day", "Kudos emoji", "Hugs a day"]) expect(field(name)).not.toHaveAttribute("readonly");
  });

  it("holds the fields from the answer until the read shows the save, so nothing typed in between is lost", async () => {
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(), async () => ({ kind: "set" }));
    await user.clear(field("Kudos a day"));
    await user.type(field("Kudos a day"), "5");
    await user.click(saveButton());

    await user.type(field("Kudos a day"), "7");
    expect(field("Kudos a day")).toHaveAttribute("readonly");
    expect(field("Kudos a day")).toHaveValue(5);

    showSettingsAnswer(forTheMaintainer({ ...workspaceParts.defaults, baseAllowance: 5 }));
    expect(field("Kudos a day")).not.toHaveAttribute("readonly");
    await user.clear(field("Kudos a day"));
    await user.type(field("Kudos a day"), "3");
    expect(field("Kudos a day")).toHaveValue(3);
  });

  it("drops the saved line once a saved hug budget of 0 is cleared", async () => {
    const zero = { ...workspaceParts.defaults, hugBudget: 0 };
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(), async () => ({ kind: "set" }));
    await user.clear(field("Hugs a day"));
    await user.type(field("Hugs a day"), "0");
    await user.click(saveButton());
    showSettingsAnswer(forTheMaintainer(zero));
    expect(await within(workspaceSection()).findByText("Saved. Every member gives and hugs by these from now on.")).toBeInTheDocument();

    await user.clear(field("Hugs a day"));

    expect(status()).not.toHaveTextContent("Saved.");
  });

  it("drops the saved line once the maintainer edits again", async () => {
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(), async () => ({ kind: "set" }));
    await user.clear(field("Kudos a day"));
    await user.type(field("Kudos a day"), "5");
    await user.click(saveButton());
    showSettingsAnswer(forTheMaintainer({ ...workspaceParts.defaults, baseAllowance: 5 }));
    expect(await within(workspaceSection()).findByText("Saved. Every member gives and hugs by these from now on.")).toBeInTheDocument();

    await user.type(field("Kudos a day"), "0");

    expect(status()).not.toHaveTextContent("Saved.");
  });

  it.each<[string, WorkspaceSettingsReply, string]>([
    ["an allowance out of range", { kind: "refused", reason: "allowance" }, "Kudos a day is a whole number from 1 to 20."],
    ["a malformed emoji", { kind: "refused", reason: "kudos-emoji" }, "Type one emoji's name, like :taco:, without a skin tone."],
    ["a hug budget out of range", { kind: "refused", reason: "hug-budget" }, "Hugs a day is a whole number from 0 to 50."],
    ["someone who isn't the maintainer", { kind: "refused", reason: "not-maintainer" }, "Only HedgeHug's maintainer can change these."],
    ["workspace-settings off", { kind: "refused", reason: null }, "Workspace settings aren't open for you right now."],
  ])("says the refusal for %s in its own sentence and keeps what was typed", async (_, reply, line) => {
    const { user } = await showSettings(forTheMaintainer(), async () => reply);

    await user.clear(field("Kudos a day"));
    await user.type(field("Kudos a day"), "7");
    await user.click(saveButton());

    expect(status()).toHaveTextContent(line);
    expect(field("Kudos a day")).toHaveValue(7);
  });

  it("says when the server can't be reached", async () => {
    const { user } = await showSettings(forTheMaintainer(), () => Promise.reject(new Error("offline")));

    await user.clear(field("Hugs a day"));
    await user.type(field("Hugs a day"), "4");
    await user.click(saveButton());

    expect(status()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
  });

  it("has no accessibility violations", async () => {
    await showSettings(forTheMaintainer());

    const { violations } = await axe.run(workspaceSection());

    expect(violations).toEqual([]);
  });
});
