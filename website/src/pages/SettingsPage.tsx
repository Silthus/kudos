import type { ReactNode } from "react";
import { Panel } from "../settings/Panel";
import { panelTargetAttributes } from "../linkTarget";
import { VisibilitySwitch } from "../leaderboard/VisibilitySwitch";
import { PageTitle } from "../PageTitle";
import type { EmojiMappingsRead } from "../emojiMappingsRead";
import { SignOutButton } from "../SignOutButton";
import { ThemeChoices } from "../ThemeControl";
import { CompanyProfileSection } from "../settings/CompanyProfileSection";
import { EmojiMappingSection } from "../settings/EmojiMapping";
import { GroupPicker } from "../settings/GroupPicker";
import { MessageSettingRow } from "../settings/MessageSettingRow";
import { TeammateMatching } from "../settings/TeammateMatching";
import { WorkspaceSettings } from "../settings/WorkspaceSettings";
import type { MessageSetting, MySettings, ShellActions } from "../shell";

type SettingsPageProps = { settings: MySettings; actions: Pick<ShellActions, "setMessageSetting" | "setBoardVisibility" | "pickPrimaryGroup" | "linkMyCompanyProfile" | "linkCompanyProfile" | "setWorkspaceSettings" | "mapSlackEmoji">; useEmojiMappings: EmojiMappingsRead; themeAndSignOut?: { onSignOut: () => void }; albumSections?: ReactNode };

export function SettingsPage({ settings: { messages, board, group, companyProfile, admin, workspace }, actions, useEmojiMappings, themeAndSignOut, albumSections }: SettingsPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="hud-label">You</span>
        <PageTitle tab="Settings" size="display">
          Settings
        </PageTitle>
        <p className="text-sm text-muted-foreground">Your choices in one place. Changes here show in Slack's App Home too.</p>
      </header>
      {themeAndSignOut !== undefined && <AppearancePanel />}
      {messages !== null && <Messages messages={messages} setMessageSetting={actions.setMessageSetting} />}
      {board !== null && (
        <Panel id="leaderboards" label="Leaderboards" target={panelTargetAttributes("visibility")}>
          <p className="text-sm text-muted-foreground">When you're off, nobody sees you on the leaderboards, you included.</p>
          <div className="text-sm font-semibold">
            <VisibilitySwitch onTheBoards={board.onTheBoards} setBoardVisibility={actions.setBoardVisibility} />
          </div>
        </Panel>
      )}
      {group !== null && (
        <Panel id="your-group" label="Your group" target={panelTargetAttributes("group")}>
          <p className="text-sm text-muted-foreground">Your kudos count for one group on the leaderboard.</p>
          <GroupPicker choice={group} pickPrimaryGroup={actions.pickPrimaryGroup} />
        </Panel>
      )}
      {companyProfile !== undefined && <CompanyProfileSection setting={companyProfile} linkMyCompanyProfile={actions.linkMyCompanyProfile} />}
      {admin !== undefined && <TeammateMatching admin={admin} linkCompanyProfile={actions.linkCompanyProfile} />}
      {workspace !== undefined && <WorkspaceSettings workspace={workspace} setWorkspaceSettings={actions.setWorkspaceSettings} />}
      {workspace !== undefined && <EmojiMappingSection useEmojiMappings={useEmojiMappings} mapSlackEmoji={actions.mapSlackEmoji} />}
      {albumSections}
      {themeAndSignOut !== undefined && <AccountPanel onSignOut={themeAndSignOut.onSignOut} />}
    </div>
  );
}

export function ThemeAndSignOut({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <AppearancePanel />
      <AccountPanel onSignOut={onSignOut} />
    </div>
  );
}

function AppearancePanel() {
  return (
    <Panel id="appearance" label="Appearance">
      <p className="text-sm text-muted-foreground">How HedgeHug looks in this browser.</p>
      <ThemeChoices />
    </Panel>
  );
}

function AccountPanel({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Panel id="account" label="Account">
      <p className="text-sm text-muted-foreground">Sign out of HedgeHug in this browser. Your album stays as it is.</p>
      <div>
        <SignOutButton onSignOut={onSignOut} />
      </div>
    </Panel>
  );
}

function Messages({ messages, setMessageSetting }: { messages: MessageSetting[]; setMessageSetting: ShellActions["setMessageSetting"] }) {
  return (
    <Panel id="messages" label="Messages" target={panelTargetAttributes("messages")}>
      <p className="text-sm text-muted-foreground">In the channel means a message only you see, beside the kudos that caused it. If I can't post it there, it comes as a DM.</p>
      <div className="flex flex-col">
        {messages.map((setting) => (
          <MessageSettingRow key={setting.kind} setting={setting} setMessageSetting={setMessageSetting} />
        ))}
      </div>
    </Panel>
  );
}
