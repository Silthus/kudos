import { describe, expect, test } from "vitest";
import { renderManifest } from "./manifest";

const siteUrl = "https://example-deployment.convex.site";

describe.each(["sandbox", "real"] as const)("the %s manifest", (environment) => {
  const manifest = renderManifest(environment, siteUrl);

  test("asks for every spec 1 bot scope up front, users:read.email for the directory's member profiles (F4), usergroups:read for its user groups, emoji:read for its custom emoji, reactions:read for hugs (SR17), channels:read to list and hear about every public channel it joins, channels:manage with groups:read and groups:write to leave shared and customer channels, and links:read with links:write to unfold person and team links (LP78)", () => {
    expect(manifest.oauth_config.scopes.bot.toSorted()).toEqual(
      ["channels:history", "channels:join", "channels:manage", "channels:read", "chat:write", "chat:write.public", "commands", "emoji:read", "groups:history", "groups:read", "groups:write", "links:read", "links:write", "reactions:read", "reactions:write", "usergroups:read", "users:read", "users:read.email"],
    );
  });

  test("registers the deployment's own host, where the website lives, as its one unfurl domain (LP78)", () => {
    expect(manifest.features.unfurl_domains).toEqual(["example-deployment.convex.site"]);
  });

  test("asks only the user scopes Sign in with Slack needs", () => {
    expect(manifest.oauth_config.scopes.user.toSorted()).toEqual(["openid", "profile"]);
  });

  test("lets Sign in with Slack return to the deployment's auth callback", () => {
    expect(manifest.oauth_config.redirect_urls).toEqual([
      "https://example-deployment.convex.site/api/auth/callback/slack",
    ]);
  });

  test("subscribes to every spec 1 bot event, the user group events, emoji_changed, reaction_added for hugs (SR17), channel_created to join each new public channel, channel_shared, channel_rename, group_rename and member_joined_channel to leave a channel once it is shared or a customer's, and link_shared to unfold person and team links (LP78) at the deployment's events route", () => {
    expect(manifest.settings.event_subscriptions).toEqual({
      request_url: "https://example-deployment.convex.site/slack/events",
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
    });
  });

  test("registers only /hedgehug at the deployment's commands route, with escaping on", () => {
    expect(manifest.features.slash_commands).toEqual([
      expect.objectContaining({
        command: "/hedgehug",
        url: "https://example-deployment.convex.site/slack/commands",
        should_escape: true,
      }),
    ]);
  });

  test("sends App Home clicks and the custom emoji picker's searches (ST31) to the deployment's interactivity route", () => {
    expect(manifest.settings.interactivity).toEqual({
      is_enabled: true,
      request_url: "https://example-deployment.convex.site/slack/interactivity",
      message_menu_options_url: "https://example-deployment.convex.site/slack/interactivity",
    });
  });

  test("names the bot HedgeHug, capitalized like the product", () => {
    expect(manifest.features.bot_user.display_name).toBe("HedgeHug");
  });

  test("turns the Home tab on", () => {
    expect(manifest.features.app_home.home_tab_enabled).toBe(true);
  });

  test("is a single-workspace app without socket mode", () => {
    expect(manifest.settings).toMatchObject({ org_deploy_enabled: false, socket_mode_enabled: false });
  });
});

test("the sandbox app is told apart from the real one by its name", () => {
  expect(renderManifest("sandbox", siteUrl).display_information.name).toBe("HedgeHug (sandbox)");
  expect(renderManifest("real", siteUrl).display_information.name).toBe("HedgeHug");
});

test("a site URL with a trailing slash renders the same routes", () => {
  expect(renderManifest("real", `${siteUrl}/`).settings.event_subscriptions.request_url).toBe(
    "https://example-deployment.convex.site/slack/events",
  );
});
