export type Environment = "sandbox" | "real";

export const environments: readonly Environment[] = ["sandbox", "real"];

const appNames: Record<Environment, string> = { sandbox: "Kudos (sandbox)", real: "Kudos" };

export function renderManifest(environment: Environment, siteUrl: string) {
  const route = (path: string) => new URL(path, siteUrl).toString();
  return {
    display_information: {
      name: appNames[environment],
      description: "Thank your teammates with kudos, right where the help happened.",
    },
    features: {
      app_home: { home_tab_enabled: true, messages_tab_enabled: true, messages_tab_read_only_enabled: true },
      bot_user: { display_name: "Kudos", always_online: true },
      slash_commands: [
        {
          command: "/kudos",
          url: route("/slack/commands"),
          description: "Add Kudos to this channel",
          should_escape: true,
        },
      ],
    },
    oauth_config: {
      scopes: {
        bot: ["channels:history", "groups:history", "reactions:write", "chat:write", "users:read", "channels:join", "commands"],
      },
    },
    settings: {
      event_subscriptions: {
        request_url: route("/slack/events"),
        bot_events: ["app_home_opened", "message.channels", "message.groups", "team_join", "user_change"],
      },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
}
