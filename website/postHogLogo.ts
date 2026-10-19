import { Logo } from "@posthog/brand/logo";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Plugin } from "vite";

const moduleId = "virtual:posthog-stacked-logo";

const resolvedId = `\0${moduleId}`;

export function postHogLogo(): Plugin {
  return {
    name: "posthog-stacked-logo",
    resolveId: (id) => (id === moduleId ? resolvedId : undefined),
    load: (id) => (id === resolvedId ? `export default ${JSON.stringify(stackedMonoLogo())};` : undefined),
  };
}

function stackedMonoLogo() {
  return renderToStaticMarkup(createElement(Logo, { layout: "stacked", variant: "mono", width: 96, height: 86 }));
}
