// @vitest-environment happy-dom
import { expect, test } from "vitest";
import { escapesFromScrollers } from "./layout";

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
