import type { ReactNode } from "react";
import type { EmojiMappingsRead } from "../emojiMappingsRead";
import type { SettingsShown } from "../settingsRead";
import type { ShellActions } from "../shell";
import { AnswerPage, type Answers } from "./AnswerPage";
import { LoadingPage } from "./LoadingPage";
import { NotFoundPage } from "./NotFoundPage";
import { SettingsPage, ThemeAndSignOut } from "./SettingsPage";

export type SettingsActions = Pick<ShellActions, "setMessageSetting" | "setBoardVisibility" | "pickPrimaryGroup" | "linkMyCompanyProfile" | "linkCompanyProfile" | "setWorkspaceSettings" | "setWeeklyPost" | "mapSlackEmoji">;

type SettingsAnswerPageProps = { settings: SettingsShown | undefined; actions: SettingsActions; useEmojiMappings: EmojiMappingsRead; albumSections?: ReactNode } & Answers;

export function SettingsAnswerPage({ settings, actions, useEmojiMappings, albumSections, ...answers }: SettingsAnswerPageProps) {
  if (settings?.kind === "settings") return <SettingsPage settings={settings} actions={actions} useEmojiMappings={useEmojiMappings} onSignOut={answers.onSignOut} albumSections={albumSections} />;
  const answered = <SettingsElsewhere settings={settings} {...answers} />;
  if (!settingsStillMissing(settings)) return answered;
  return (
    <>
      {answered}
      <ThemeAndSignOut onSignOut={answers.onSignOut} />
    </>
  );
}

function SettingsElsewhere({ settings, ...answers }: { settings: Exclude<SettingsShown, { kind: "settings" }> | undefined } & Answers) {
  if (settings === undefined) return <LoadingPage shape="column" />;
  if (settings.kind === "not-found") return <NotFoundPage />;
  return <AnswerPage answer={settings} {...answers} />;
}

function settingsStillMissing(settings: SettingsShown | undefined) {
  return settings === undefined || settings.kind === "not-found" || settings.kind === "broken" || settings.kind === "connecting";
}
