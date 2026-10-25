import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KudosMessage } from "./activity/KudosMessage";
import { NavigateProvider } from "./AppLink";
import type { Message, Segment } from "./shell";

function words(...segments: Segment[]): Message {
  return { kind: "text", segments, edited: false };
}

function shown(message: Message, { look = "album", me }: { look?: "album" | "slack"; me?: { person: string; name: string } } = {}) {
  return render(<KudosMessage message={message} look={look} me={me} />).container;
}

function hrefsIn(container: HTMLElement) {
  return [...container.querySelectorAll("[href]")].map((element) => element.getAttribute("href"));
}

describe("WS210: one renderer for a kudos message", () => {
  it("renders text in strong, em, s and code for each flag it carries", () => {
    const container = shown(words({ kind: "text", text: "plain " }, { kind: "text", text: "all of them", bold: true, italic: true, strike: true, code: true }));

    expect(container).toHaveTextContent("plain all of them");
    const styled = screen.getByText("all of them");
    expect(styled.closest("strong")).not.toBeNull();
    expect(styled.closest("em")).not.toBeNull();
    expect(styled.closest("s")).not.toBeNull();
    expect(styled.closest("code")).not.toBeNull();
    expect(screen.getByText("plain").closest("strong, em, s, code")).toBeNull();
  });

  it("links a mention of a member the album knows to their person page by name, followed in place", () => {
    const followed: string[] = [];
    const { container } = render(
      <NavigateProvider value={(href) => followed.push(href)}>
        <KudosMessage message={words({ kind: "text", text: "Thanks " }, { kind: "person", name: "Dev Rao", person: "member/dev 1" })} />
      </NavigateProvider>,
    );

    const mention = screen.getByRole("link", { name: "@Dev Rao" });
    expect(mention).toHaveAttribute("href", "/book#people/member%2Fdev%201");
    expect(mention).not.toHaveAttribute("target");
    fireEvent.click(mention);
    expect(followed).toEqual(["/book#people/member%2Fdev%201"]);
    expect(container).toHaveTextContent("Thanks @Dev Rao");
  });

  it("renders a mention of someone the album doesn't know, groups, channels and broadcasts as plain styled text, never links", () => {
    const container = shown(
      words(
        { kind: "person", name: "A teammate" },
        { kind: "text", text: " " },
        { kind: "group", handle: "design-team" },
        { kind: "text", text: " " },
        { kind: "channel" },
        { kind: "text", text: " " },
        { kind: "broadcast", range: "here" },
        { kind: "broadcast", range: "channel" },
        { kind: "broadcast", range: "everyone" },
      ),
    );

    expect(container).toHaveTextContent("@A teammate @design-team #channel @here@channel@everyone");
    expect(screen.getByText("@A teammate")).toHaveClass("font-medium");
    expect(screen.getByText("#channel")).toHaveClass("text-muted-foreground");
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("in the Slack look renders a known member's mention as text, so nothing in a flying excerpt is focusable", () => {
    const container = shown(words({ kind: "person", name: "Dev Rao", person: "member-dev" }), { look: "slack" });

    expect(container).toHaveTextContent("@Dev Rao");
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("in the Slack look marks every mention as Slack does, a mention of me and a broadcast louder than the rest", () => {
    shown(words({ kind: "person", name: "Sam Example", person: "member-me" }, { kind: "person", name: "Dev Rao", person: "member-dev" }, { kind: "group", handle: "design-team" }, { kind: "channel" }, { kind: "broadcast", range: "here" }), { look: "slack", me: { person: "member-me", name: "Sam Example" } });

    expect(screen.getByText("@Sam Example")).toHaveAttribute("data-mention", "loud");
    expect(screen.getByText("@here")).toHaveAttribute("data-mention", "loud");
    expect(screen.getByText("@Dev Rao")).toHaveAttribute("data-mention", "plain");
    expect(screen.getByText("@design-team")).toHaveAttribute("data-mention", "plain");
    expect(screen.getByText("#channel")).toHaveAttribute("data-mention", "plain");
  });

  it("in the Slack look knows a mention of me by name when the read names people without linking them, and a namesake by their member", () => {
    shown(words({ kind: "person", name: "Sam Example" }, { kind: "person", name: "Sam Example", person: "member-namesake" }), { look: "slack", me: { person: "member-me", name: "Sam Example" } });

    expect(screen.getAllByText("@Sam Example").map((mention) => mention.getAttribute("data-mention"))).toEqual(["loud", "plain"]);
  });

  it("renders an emoji as its unicode, else as its name between colons", () => {
    const container = shown(words({ kind: "emoji", name: "tada", unicode: "🎉" }, { kind: "emoji", name: "partyparrot" }));

    expect(container).toHaveTextContent("🎉:partyparrot:");
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws a custom emoji with a picture as that picture at text size, named by its colons", () => {
    shown(words({ kind: "text", text: "Shipped " }, { kind: "emoji", name: "partyparrot", image: "https://emoji.slack-edge.com/T1/partyparrot/abc.gif" }));

    const picture = screen.getByRole("img", { name: ":partyparrot:" });
    expect(picture).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/partyparrot/abc.gif");
    expect(picture).toHaveClass("h-[1.2em]", "w-auto", "inline");
    expect(screen.queryByText(":partyparrot:")).toBeNull();
  });

  it("draws a custom emoji whose picture fails to load as its name between colons", () => {
    const container = shown(words({ kind: "emoji", name: "partyparrot", image: "https://emoji.slack-edge.com/T1/partyparrot/gone.gif" }));

    fireEvent.error(screen.getByRole("img", { name: ":partyparrot:" }));

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent(":partyparrot:");
  });

  it("draws a custom emoji's picture even where its name is also a standard shortcode", () => {
    const container = shown(words({ kind: "emoji", name: "taco", image: "https://emoji.slack-edge.com/T1/taco/abc.png" }));

    expect(screen.getByRole("img", { name: ":taco:" })).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/taco/abc.png");
    expect(container).not.toHaveTextContent("🌮");
  });

  it.each([
    ["a skin-toned name by the table's toned character, before Slack's untoned unicode and a picture", { kind: "emoji", name: "wave::skin-tone-3", unicode: "👋", image: "https://emoji.slack-edge.com/T1/wave/abc.png" }, "👋🏼"],
    ["a skin-toned name by Slack's toned unicode where the table knows the name but not the tone", { kind: "emoji", name: "wrestlers::skin-tone-3", unicode: "🤼🏼" }, "🤼🏼"],
    ["a skin-toned name the table doesn't know by Slack's unicode, before a picture", { kind: "emoji", name: "newer_than_the_table::skin-tone-2", unicode: "🫨", image: "https://emoji.slack-edge.com/T1/newer/abc.png" }, "🫨"],
    ["any other name by Slack's unicode, before the table's character", { kind: "emoji", name: "wave", unicode: "👋🏽" }, "👋🏽"],
  ] satisfies [string, Segment, string][])("draws %s", (_, segment, drawn) => {
    const container = shown(words(segment));

    expect(container).toHaveTextContent(drawn);
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws a skin-toned name's picture before the table's untoned character", () => {
    const container = shown(words({ kind: "emoji", name: "wrestlers::skin-tone-3", image: "https://emoji.slack-edge.com/T1/wrestlers/abc.png" }));

    expect(screen.getByRole("img", { name: ":wrestlers::skin-tone-3:" })).toBeInTheDocument();
    expect(container).not.toHaveTextContent("🤼");
  });

  it("draws an emoji's unicode before its picture", () => {
    const container = shown(words({ kind: "emoji", name: "tada", unicode: "🎉", image: "https://emoji.slack-edge.com/T1/tada/abc.png" }));

    expect(container).toHaveTextContent("🎉");
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a break as a line break", () => {
    const container = shown(words({ kind: "text", text: "one" }, { kind: "break" }, { kind: "text", text: "two" }));

    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("links an http or https URL in a new tab, showing its label or else its URL", () => {
    shown(words({ kind: "link", url: "https://example.com/doc", label: "the doc" }, { kind: "text", text: " and " }, { kind: "link", url: "http://example.com/plain" }));

    const labelled = screen.getByRole("link", { name: "the doc (opens in a new tab)" });
    expect(labelled).toHaveAttribute("href", "https://example.com/doc");
    expect(labelled).toHaveAttribute("target", "_blank");
    expect(labelled).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByRole("link", { name: "http://example.com/plain (opens in a new tab)" })).toHaveAttribute("href", "http://example.com/plain");
  });

  it("renders a link with any other scheme, or no URL at all, as its text", () => {
    const container = shown(words({ kind: "link", url: "mailto:sam@example.com", label: "write to me" }, { kind: "text", text: " " }, { kind: "link", url: "not a url" }));

    expect(container).toHaveTextContent("write to me not a url");
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("in the Slack look renders every link as its text in Slack's link colour, never cut to a few lines", () => {
    const container = shown(words({ kind: "link", url: "https://example.com/doc", label: "the doc" }), { look: "slack" });

    expect(container).toHaveTextContent("the doc");
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.getByText("the doc")).toHaveAttribute("data-link");
    expect(screen.getByTestId("kudos-message-words").className).not.toMatch(/line-clamp/);
  });

  it.each([
    ["deleted", "This message was deleted in Slack."],
    ["removed", "The words of this message were removed."],
    ["not-captured", "The words of this kudos are from before HedgeHug kept them."],
  ] as const)("renders an unavailable message, %s, as one muted italic line", (reason, line) => {
    const container = shown({ kind: "unavailable", reason });

    expect(container).toHaveTextContent(line);
    expect(screen.getByText(line)).toHaveClass("italic", "text-muted-foreground");
  });

  it("adds a muted Edited after the words of an edited message", () => {
    const container = shown({ kind: "text", segments: [{ kind: "text", text: "Thanks" }], edited: true });

    expect(container).toHaveTextContent("ThanksEdited");
    expect(screen.getByText("Edited")).toHaveClass("text-muted-foreground");
  });

  it("in the Slack look adds (edited) as Slack does", () => {
    const container = shown({ kind: "text", segments: [{ kind: "text", text: "Thanks" }], edited: true }, { look: "slack" });

    expect(container).toHaveTextContent("Thanks (edited)");
  });

  it("renders nothing for a segment kind it doesn't know", () => {
    const unknown = { kind: "canvas", title: "Roadmap" } as unknown as Segment;
    const container = shown(words({ kind: "text", text: "See " }, unknown, { kind: "text", text: "above" }));

    expect(container).toHaveTextContent("See above");
    expect(container).not.toHaveTextContent("Roadmap");
  });
});

describe("a kudos message renders as text", () => {
  const hostile = words(
    { kind: "text", text: "<script>alert(1)</script>" },
    { kind: "text", text: '<img src=x onerror="alert(2)">', bold: true },
    { kind: "text", text: "&lt;b&gt; &amp; &#60;i&#62;" },
    { kind: "link", url: "javascript:alert(3)", label: "click me" },
    { kind: "link", url: "data:text/html,<script>alert(4)</script>" },
    { kind: "link", url: "https://example.com/safe", label: "safe" },
    { kind: "person", name: "<b>Eve</b>", person: "javascript:alert(5)" },
  );

  it.each([
    ["in the album look", "album"],
    ["in the Slack look", "slack"],
  ] as const)("keeps markup, entities and unsafe links as text %s", (_, look) => {
    const container = shown(hostile, { look });

    expect(container).toHaveTextContent('<script>alert(1)</script><img src=x onerror="alert(2)">&lt;b&gt; &amp; &#60;i&#62;click me');
    expect(container).toHaveTextContent("@<b>Eve</b>");
    expect(container).toHaveTextContent("data:text/html,<script>alert(4)</script>");
    expect(container.querySelector("script, img, b, i")).toBeNull();
    expect(hrefsIn(container).every((href) => href !== null && /^(https?:|\/book#people\/)/.test(href))).toBe(true);
    expect(hrefsIn(container)).toEqual(look === "slack" ? [] : ["https://example.com/safe", "/book#people/javascript%3Aalert(5)"]);
  });
});
