import { routeOf } from "../route";
import { onAddressChange } from "./addressChanges";

export type PageProperties = { page: string; book_page?: string; spread?: string };

type Capturer = {
  capture: (event: string, properties?: Record<string, unknown>) => unknown;
  register: (properties: Record<string, unknown>) => void;
  unregister: (property: string) => void;
};

const bookOnly = ["book_page", "spread"] as const;

export function captureEveryPageview(posthog: Capturer): () => void {
  let last: { address: string; properties: PageProperties } | null = null;
  const view = () => {
    const address = addressOf(window.location);
    if (address === last?.address) return;
    if (last !== null) posthog.capture("$pageleave", last.properties);
    const properties = pagePropertiesOf(window.location);
    for (const property of bookOnly) if (!(property in properties)) posthog.unregister(property);
    posthog.register(properties);
    posthog.capture("$pageview", properties);
    last = { address, properties };
  };
  view();
  return onAddressChange(view);
}

function addressOf(location: Location) {
  return JSON.stringify([routeOf(location), location.hash]);
}

export function pagePropertiesOf(location: Pick<Location, "pathname" | "search" | "hash">): PageProperties {
  const route = routeOf(location);
  if (route.page !== "book") return { page: route.page };
  const spread = route.spread === undefined ? {} : { spread: location.hash.replace(/^#/, "") };
  return { page: route.page, book_page: route.bookPage, ...spread };
}
