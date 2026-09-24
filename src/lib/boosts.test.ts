import { expect, test } from "vitest";
import { announcementStatus, startedBy } from "./boosts";

test("an announcement's status reads as what the admin can do about it", () => {
  expect(announcementStatus({ status: "sent", channel: "announcements" }, false)).toEqual({ tone: "ok", text: "Posted in #announcements" });
  expect(announcementStatus({ status: "failed", channel: "announcements", error: "not_in_channel" }, false)).toEqual({
    tone: "error",
    text: "Not posted: the Kudos app isn't in #announcements. Invite it there with /invite @Kudos; the boost runs anyway.",
  });
  expect(announcementStatus({ status: "failed", channel: "announcements", error: "channel_not_found" }, false)).toEqual({
    tone: "error",
    text: "Not posted in #announcements (channel_not_found). The boost runs anyway.",
  });
  expect(announcementStatus({ status: "pending", channel: "announcements" }, false)).toEqual({ tone: "muted", text: "Posting in #announcements…" });
  expect(announcementStatus({ status: "skipped" }, false)).toEqual({ tone: "muted", text: "Banner only: no announcement channel was set" });
  expect(announcementStatus({ status: "skipped" }, true)).toEqual({ tone: "muted", text: "Preview: the demo has no Slack, so nothing is posted" });
});

test("who started a boost", () => {
  expect(startedBy("schedule", "Ana")).toBe("Scheduled by Ana");
  expect(startedBy("booster", "Ben")).toBe("Booster bought by Ben");
  expect(startedBy("booster", null)).toBe("Booster bought by a former member");
  expect(startedBy("team_garden", null)).toBe("A team garden milestone");
  expect(startedBy("capstone", "Cleo")).toBe("Called by Cleo (Block party)");
});
