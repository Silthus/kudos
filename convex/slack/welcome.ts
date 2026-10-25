import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { welcomePickValidator, type WelcomeGroups, type WelcomeMessage } from "../feedback/welcome";
import { waitingHoggiesLineOf } from "../feedback/waitingHoggies";
import { onboardingGoalOf, type OnboardingQuest, type OnboardingStep } from "../quests/onboarding";
import { mondayWelcomeCauseValidator, onboardingJourneyValidator, onboardingStepValidator, type HuggedPeople, type MondayWelcome, type MondayWelcomeOpening, type WelcomeOutcome } from "../welcome/mondayWelcome";
import { welcomedAsValidator } from "../welcome/welcomedAs";
import { appHomeLink, appHomeUrl } from "./appHomeLinks";
import { escaped, mrkdwn, plainText, urlButtonOf } from "./blocks";
import { attemptArgs, attemptCall, retryAfter, sendAtMostOnce, sendOnce, slackLink, slackTextOf, tryAtMostThreeTimes, type Attempt } from "./delivery";
import { groupSelectOf } from "./groupPicker";
import { encodeHomeAction, showMeHowAction } from "./interactivity";

const pickedGroupField = "group";

export const deliverWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), welcomed: v.optional(welcomedAsValidator), groups: v.optional(v.literal(true)), ...attemptArgs },
  handler: async (ctx, { attempt = 1, groups: groupsShown, ...welcome }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, welcome);
        const groups = groupsShown ? await ctx.runMutation(internal.feedback.welcome.welcomeGroupsOf, { workspace: welcome.workspace, user: welcome.user }) : null;
        return sendOnce(ctx, welcome.workspace, "chat.postMessage", { channel: welcome.user, ...messageOf(message, groups, welcome.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.deliverWelcome, { ...welcome, ...(groupsShown && { groups: groupsShown }), attempt: retry.attempt }),
    );
  },
});

export const updateWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), conversation: v.string(), message: v.string(), pick: welcomePickValidator, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...update }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const groups = await ctx.runMutation(internal.feedback.welcome.welcomeGroupsOf, { workspace: update.workspace, user: update.user, pick: update.pick });
        if (groups === null) return null;
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, { workspace: update.workspace, user: update.user });
        return sendOnce(ctx, update.workspace, "chat.update", { channel: update.conversation, ts: update.message, ...messageOf(message, groups, update.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.updateWelcome, { ...update, attempt: retry.attempt }),
    );
  },
});

export const deliverMondayWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), member: v.id("members"), cause: mondayWelcomeCauseValidator, journey: onboardingJourneyValidator, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...welcome }) => {
    const ended: { outcome?: WelcomeOutcome } = {};
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const message = await ctx.runQuery(internal.welcome.mondayWelcome.mondayWelcomeOf, { workspace: welcome.workspace, member: welcome.member, cause: welcome.cause, journey: welcome.journey });
        const sent = await attemptCall(ctx, welcome.workspace, "chat.postMessage", { channel: welcome.user, ...mondayWelcomeMessageOf(message, welcome.user) });
        if (sent.kind === "held" || sent.kind === "failed") return retryAfter(sent, attempt);
        ended.outcome = outcomeOf(sent);
        return null;
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.deliverMondayWelcome, { ...welcome, attempt: retry.attempt }),
      async () => {
        ended.outcome = "failed";
      },
    );
    if (ended.outcome !== undefined) await ctx.runMutation(internal.welcome.mondayWelcome.welcomeEnded, { workspace: welcome.workspace, member: welcome.member, path: welcome.cause.path, outcome: ended.outcome });
  },
});

function outcomeOf(sent: Extract<Attempt, { kind: "delivered" | "gone" | "unknown" }>): WelcomeOutcome {
  return sent.kind === "unknown" ? "failed" : sent.kind;
}

const recipientsNamedAtMost = 3;

const howTos: Record<OnboardingStep, (kudosEmoji: string) => string> = {
  "first-thanks": (kudosEmoji) => `Mention them, add :${kudosEmoji}: and write a sentence about what they did.`,
  "someone-new": () => "Someone from another team counts too.",
  "two-days": () => "Two kudos that say why, on two different days.",
};

const onboardingReward = "🎁 +50 XP and an unidentified Hoggie for your collection";

export const howToAskedValidator = v.object({ conversation: v.string(), welcome: v.string(), step: onboardingStepValidator });

const exampleKudos = "@Ana thanks for untangling the deploy, it saved my afternoon";

export const replyWithHowTo = observedAction({
  args: { workspace: v.string(), ...howToAskedValidator.fields, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...reply }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const { kudosEmoji } = await ctx.runQuery(internal.welcome.mondayWelcome.howToOf, { workspace: reply.workspace });
        return sendAtMostOnce(ctx, reply.workspace, "chat.postMessage", { channel: reply.conversation, thread_ts: reply.welcome, text: howToReplyOf(reply.step, kudosEmoji), unfurl_links: false, unfurl_media: false }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.replyWithHowTo, { ...reply, attempt: retry.attempt }),
    );
  },
});

function howToReplyOf(step: OnboardingStep, kudosEmoji: string) {
  return `*How to ${onboardingGoalOf(step).toLowerCase()}*\n${howTos[step](kudosEmoji)}\n\nA kudos that says why looks like this, in any channel I'm in:\n> ${exampleKudos} :${kudosEmoji}:`;
}

function mondayWelcomeMessageOf(welcome: MondayWelcome, user: string) {
  return {
    text: fallbackOf(welcome.opening),
    blocks: [{ type: "section", text: mrkdwn(noteOf(welcome, user)) }, { type: "divider" }, ...cardOf(welcome), ...welcomeButtonsOf(welcome)],
    unfurl_links: false,
    unfurl_media: false,
  };
}

function fallbackOf(opening: MondayWelcomeOpening) {
  switch (opening.path) {
    case "hug":
      return "Nice, that was your first hug!";
    case "thoughtful-given":
      return "You just completed the first step of your onboarding journey.";
    case "thoughtful-received":
      return `<@${opening.giver}> just thanked you with a kudos!`;
    case "catch-up":
      return "A hoggie was stuck in the pipe, which kept this welcome from coming out. Here it is now.";
  }
}

function noteOf({ opening, kudosEmoji, waiting }: MondayWelcome, user: string) {
  const greeting = `Hey <@${user}> :wave::skin-tone-2:`;
  const waits = waitingHoggiesLineOf(waiting);
  const after = (separator: string) => (waits === null ? "" : `${separator}${waits}`);
  switch (opening.path) {
    case "hug":
      return `${greeting} Nice, that was your first hug!\n\nA :${opening.emoji}: reaction is a quick thanks, and it just gave you and ${huggedPeopleOf(opening.hugged)} +1 XP. Want to really make someone's day? Thank them in a message and say why.${after("\n\n")}`;
    case "thoughtful-given":
      return `${greeting} Your first kudos just landed${recipientsOf(opening.recipients)}, and you said why. That's the one that counts! :tada:\n\nYou just completed the first step of your onboarding journey.${after(" ")}`;
    case "thoughtful-received":
      return `${greeting} <@${opening.giver}> just thanked you with a kudos!${opening.quote === null ? "" : `\n> _${escaped(opening.quote)}_`}\n\nFeels good, right? :slightly_smiling_face:${after(" ")} Your first quest is to pass it on.`;
    case "catch-up":
      return `${greeting}\n\nA hoggie was stuck in the pipe, which kept this welcome from coming out. Here it is now :sweat_smile:\n\nHedgeHug is how we thank each other here. A :${kudosEmoji}: reaction is a quick hug, and a kudos that says why is the big thanks.${after("\n\n")}`;
  }
}

function huggedPeopleOf(hugged: HuggedPeople) {
  if (hugged.kind === "peopleThanked") return "the people thanked";
  return hugged.name === undefined ? "the author" : escaped(hugged.name);
}

function recipientsOf(recipients: string[]) {
  if (recipients.length === 0) return "";
  const mentions = recipients.map((recipient) => `<@${recipient}>`);
  const named = mentions.length <= recipientsNamedAtMost ? mentions : [...mentions.slice(0, recipientsNamedAtMost - 1), `${mentions.length - (recipientsNamedAtMost - 1)} more`];
  return ` with ${named.map((name, index) => (index === 0 ? name : `${index === named.length - 1 ? " and " : ", "}${name}`)).join("")}`;
}

function cardOf({ journey, next, kudosEmoji }: MondayWelcome) {
  const done = journey.filter(({ finished }) => finished).length;
  const title = { type: "section", text: mrkdwn(`*Your onboarding journey* · ${done} of ${journey.length} done`) };
  const checklist = { type: "rich_text", elements: [{ type: "rich_text_list", style: "bullet", indent: 0, elements: journey.map((quest) => checklistItemOf(quest, next)) }] };
  if (next === null) return [title, checklist];
  const showMeHow = { type: "button", text: plainText("Show me how"), action_id: showMeHowAction, value: next };
  const upNext = { type: "section", text: mrkdwn(`*Up next: ${onboardingGoalOf(next).toLowerCase()}.*\n${howTos[next](kudosEmoji)}`), accessory: showMeHow };
  return [title, checklist, upNext, { type: "context", elements: [mrkdwn(onboardingReward)] }];
}

function checklistItemOf({ step, goal, finished, progress }: OnboardingQuest, next: OnboardingStep | null) {
  const isNext = step === next;
  const mark = finished ? { type: "emoji", name: "white_check_mark" } : isNext ? { type: "emoji", name: "point_right", skin_tone: 2 } : { type: "emoji", name: "white_circle" };
  const progressShown = progress === null ? [] : [{ type: "text", text: `  ${progress.done} of ${progress.of} ${progress.unit}`, style: { italic: true } }];
  return { type: "rich_text_section", elements: [mark, { type: "text", text: ` ${goal}`, style: { bold: isNext, strike: finished } }, ...progressShown] };
}

function welcomeButtonsOf({ links, waiting }: MondayWelcome) {
  if (links === null) return [];
  const seeYourQuests = urlButtonOf({ label: "See your quests", url: links.quests, actionId: "dm-link:welcome:quests" });
  if (waiting === 0) return [{ type: "actions", elements: [{ ...seeYourQuests, style: "primary" }] }];
  const identify = { ...urlButtonOf({ label: waiting === 1 ? "Identify it now" : "Identify them now", url: links.book, actionId: "dm-link:welcome:book" }), style: "primary" };
  return [{ type: "actions", elements: [identify, seeYourQuests] }];
}

function messageOf(welcome: WelcomeMessage, groups: WelcomeGroups | null, workspace: string) {
  return {
    text: textOf(welcome, groups, workspace),
    blocks: [...greetingBlocksOf(welcome), allowanceBlockOf(welcome), ...groupBlocksOf(groups), ...websiteBlocksOf(welcome), buttonsBlockOf(welcome, workspace)],
  };
}

function textOf(welcome: WelcomeMessage, groups: WelcomeGroups | null, workspace: string) {
  const website = welcome.website === null ? [] : [welcome.website.line, slackLink(welcome.website.link)];
  return [slackTextOf(welcome.greeting), welcome.allowance, ...(groups?.lines ?? []), ...website, appHomeLink(workspace, welcome.openAppHome)].join("\n");
}

function greetingBlocksOf({ greeting }: WelcomeMessage) {
  return greeting.map((line) => sectionOf(slackTextOf([line])));
}

function allowanceBlockOf({ allowance }: WelcomeMessage) {
  return sectionOf(allowance);
}

function groupBlocksOf(groups: WelcomeGroups | null) {
  if (groups === null) return [];
  const text = groups.lines.length === 0 ? [] : [sectionOf(groups.lines.join("\n"))];
  if (groups.picker === null) return text;
  const save = { type: "button", text: plainText("Save"), action_id: "save-primary-group", value: encodeHomeAction({ type: "pickPrimaryGroup", group: groups.picker.primary, surface: "welcome" }) };
  return [...text, { type: "actions", block_id: "primary-group", elements: [groupSelectOf(pickedGroupField, groups.picker.groups, groups.picker.primary), save] }];
}

function websiteBlocksOf({ website }: WelcomeMessage) {
  return website === null ? [] : [sectionOf(website.line)];
}

function buttonsBlockOf({ website, openAppHome }: WelcomeMessage, workspace: string) {
  const seeYourProgress = website === null ? [] : [{ ...urlButtonOf({ label: website.link.label, url: website.link.url, actionId: "welcome-website" }), style: "primary" }];
  const appHome = urlButtonOf({ label: openAppHome, url: appHomeUrl(workspace), actionId: "welcome-app-home" });
  return { type: "actions", elements: [...seeYourProgress, appHome] };
}

function sectionOf(text: string) {
  return { type: "section", text: mrkdwn(text) };
}
