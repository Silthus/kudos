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
      unfurl_domains: [new URL(siteUrl).host],
    },
    oauth_config: {
      redirect_urls: [route("/api/auth/callback/slack")],
      scopes: {
        bot: ["channels:history", "groups:history", "reactions:read", "reactions:write", "chat:write", "users:read", "users:read.email", "usergroups:read", "channels:join", "channels:read", "channels:manage", "groups:read", "groups:write", "commands", "chat:write.public", "emoji:read", "links:read", "links:write"],
        user: ["openid", "profile"],
      },
    },
    settings: {
      event_subscriptions: {
        request_url: route("/slack/events"),
        bot_events: [
          "app_home_opened",
          "channel_created",
          "channel_rename",
          "channel_shared",
          "emoji_changed",
          "group_rename",
          "link_shared",
          "member_joined_channel",
          "message.channels",
          "message.groups",
          "reaction_added",
          "subteam_created",
          "subteam_members_changed",
          "subteam_updated",
          "team_join",
          "user_change",
        ],
      },
      interactivity: { is_enabled: true, request_url: route("/slack/interactivity"), message_menu_options_url: route("/slack/interactivity") },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
}
