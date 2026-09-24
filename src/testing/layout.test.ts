// @vitest-environment happy-dom
import { expect, test } from "vitest";
import { escapesFromScrollers, widensSideways } from "./layout";

/** Ids of the elements the guard reports. */
function escapes(html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  return escapesFromScrollers(host).map((el) => el.id);
}

test("an sr-only label is contained by a positioned scroller, not by a blurred card around it", () => {
  expect(escapes(`<section class="backdrop-blur-sm"><div class="overflow-x-auto"><span id="x" class="sr-only">Compare</span></div></section>`)).toEqual(["x"]);
  expect(escapes(`<section class="backdrop-blur-sm"><div class="relative overflow-x-auto"><span id="x" class="sr-only">Compare</span></div></section>`)).toEqual([]);
  expect(escapes(`<div class="overflow-x-auto"><button class="relative"><span id="x" class="absolute"></span></button></div>`)).toEqual([]);
});

test("a containing block that only exists at some breakpoints or states does not count on a phone", () => {
  expect(escapes(`<div class="md:relative overflow-x-auto"><span id="x" class="sr-only"></span></div>`)).toEqual(["x"]);
  expect(escapes(`<div class="overflow-x-auto"><button class="active:scale-[0.98]"><span id="x" class="absolute"></span></button></div>`)).toEqual(["x"]);
});

test("'none' utilities do not create a containing block", () => {
  expect(escapes(`<div class="overflow-x-auto"><div class="transform-none filter-none"><span id="x" class="absolute"></span></div></div>`)).toEqual(["x"]);
});

test("a fixed element is only contained by a transform, filter or backdrop, never by relative", () => {
  expect(escapes(`<div class="relative overflow-x-auto"><span id="x" class="fixed"></span></div>`)).toEqual(["x"]);
  expect(escapes(`<div class="overflow-x-auto translate-x-0"><span id="x" class="fixed"></span></div>`)).toEqual([]);
});

test("any overflow other than visible clips sideways too, so vertical scrollers count", () => {
  expect(escapes(`<section class="backdrop-blur-sm"><div class="overflow-y-auto"><span id="x" class="sr-only"></span></div></section>`)).toEqual(["x"]);
});

test("the app's grain utility is positioned, and arbitrary child variants don't flag the parent", () => {
  expect(escapes(`<div class="grain overflow-hidden"><span id="x" class="absolute"></span></div>`)).toEqual([]);
  expect(escapes(`<section class="backdrop-blur-sm"><div class="overflow-x-auto"><span id="x" class="[&>span]:absolute"></span></div></section>`)).toEqual([]);
});

/** Ids of the elements `widensSideways` reports. */
function widens(html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  return widensSideways(host).map((el) => el.id);
}

test("preformatted text scrolls on its own instead of running past the page edge", () => {
  expect(widens(`<pre id="x">npx convex env set --prod SLACK_CLIENT_ID=&lt;id&gt;</pre>`)).toEqual(["x"]);
  expect(widens(`<p id="x" class="whitespace-pre">a long line</p>`)).toEqual(["x"]);
  expect(widens(`<pre id="x" class="overflow-x-auto">a long line</pre>`)).toEqual([]);
  expect(widens(`<div class="overflow-auto"><pre id="x">a long line</pre></div>`)).toEqual([]);
});

test("a scroller only holds its line back if no grid or flex item around it grows to fit the line", () => {
  // Grid and flex items won't shrink below their content unless they are `min-w-0` (or clip themselves).
  expect(widens(`<div class="grid md:grid-cols-2"><div><pre id="x" class="overflow-x-auto">a long line</pre></div></div>`)).toEqual(["x"]);
  expect(widens(`<div class="flex"><div><div><pre id="x" class="overflow-x-auto">a long line</pre></div></div></div>`)).toEqual(["x"]);
  expect(widens(`<div class="grid md:grid-cols-2"><div class="min-w-0"><pre id="x" class="overflow-x-auto">a long line</pre></div></div>`)).toEqual([]);
  // A scroll container is itself allowed to shrink, and a stacked flex column lays its items at full width.
  expect(widens(`<div class="flex"><pre id="x" class="overflow-x-auto">a long line</pre></div>`)).toEqual([]);
  expect(widens(`<div class="flex flex-col"><div><pre id="x" class="overflow-x-auto">a long line</pre></div></div>`)).toEqual([]);
  expect(widens(`<div class="flex flex-col md:flex-row"><div><pre id="x" class="overflow-x-auto">a long line</pre></div></div>`)).toEqual(["x"]);
});

test("only a scroller that scrolls on a phone rescues a line; clipping just cuts it off", () => {
  expect(widens(`<pre id="x" class="md:overflow-x-auto">a long line</pre>`)).toEqual(["x"]);
  expect(widens(`<div class="relative overflow-hidden"><pre id="x">a long line</pre></div>`)).toEqual(["x"]);
  expect(widens(`<pre id="x" class="whitespace-pre-wrap">wraps</pre>`)).toEqual([]);
});

test("items that size to their content grow to fit the line despite min-w-0", () => {
  const pre = `<pre id="x" class="overflow-x-auto">a long line</pre>`;
  expect(widens(`<div class="flex flex-col items-center">${pre}</div>`)).toEqual(["x"]);
  expect(widens(`<div class="flex flex-col items-start"><div class="min-w-0">${pre}</div></div>`)).toEqual(["x"]);
  expect(widens(`<div class="grid place-items-center"><div class="min-w-0">${pre}</div></div>`)).toEqual(["x"]);
  expect(widens(`<div class="grid place-items-center"><div class="w-full">${pre}</div></div>`)).toEqual([]);
  for (const wrapper of ["inline-block", "w-max", "w-fit"]) expect(widens(`<div class="${wrapper}">${pre}</div>`)).toEqual(["x"]);
  expect(widens(`<table><tr><td>${pre}</td></tr></table>`)).toEqual(["x"]);
  expect(widens(`<div class="hidden md:flex"><div>${pre}</div></div>`)).toEqual(["x"]);
});

test("equal grid columns never grow to fit their content", () => {
  // Tailwind's grid-cols-N is repeat(N, minmax(0, 1fr)).
  expect(widens(`<div class="grid grid-cols-1 sm:grid-cols-2"><div><pre id="x" class="overflow-x-auto">a long line</pre></div></div>`)).toEqual([]);
});
