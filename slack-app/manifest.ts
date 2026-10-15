import { botName, productName, slashCommand } from "../convex/feedback/naming.ts";

export type Environment = "sandbox" | "real";

export const environments: readonly Environment[] = ["sandbox", "real"];

const appNames: Record<Environment, string> = { sandbox: `${productName} (sandbox)`, real: productName };

export function renderManifest(environment: Environment, siteUrl: string) {
  const route = (path: string) => new URL(path, siteUrl).toString();
  return {
    display_information: {
      name: appNames[environment],
      description: "Thank your teammates with kudos, right where the help happened.",
    },
    features: {
      app_home: { home_tab_enabled: true, messages_tab_enabled: true, messages_tab_read_only_enabled: true },
      bot_user: { display_name: botName, always_online: true },
      slash_commands: [
        {
          command: slashCommand,
          url: route("/slack/commands"),
          description: `Add ${productName} to this channel`,
          should_escape: true,
        },
      ],
    },
    oauth_config: {
      redirect_urls: [route("/api/auth/callback/slack")],
      scopes: {
        bot: ["channels:history", "groups:history", "reactions:write", "chat:write", "users:read", "users:read.email", "usergroups:read", "channels:join", "commands", "chat:write.public", "emoji:read"],
        user: ["openid", "profile"],
      },
    },
    settings: {
      event_subscriptions: {
        request_url: route("/slack/events"),
        bot_events: [
          "app_home_opened",
          "emoji_changed",
          "message.channels",
          "message.groups",
          "subteam_created",
          "subteam_members_changed",
          "subteam_updated",
          "team_join",
          "user_change",
        ],
      },
      interactivity: { is_enabled: true, request_url: route("/slack/interactivity") },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
}
