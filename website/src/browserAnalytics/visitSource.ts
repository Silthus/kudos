import { visitSourceIn, visitSourceParam, type VisitSource } from "../../../convex/website/visitSource";

export type PageviewSource = VisitSource | "direct";

const storageKey = "hedgehug.visitSource";

let addressRead = false;

let sourceSent = false;

export function keepTheVisitSource() {
  if (addressRead) return;
  addressRead = true;
  const address = new URL(window.location.href);
  const source = visitSourceIn(address.searchParams.get(visitSourceParam));
  if (address.searchParams.has(visitSourceParam)) withoutTheSourceInTheAddress(address);
  if (source !== undefined) remember(source);
  else if (!backFromSignIn(address)) forget();
}

export function sourceOfTheFirstPageview(): { source?: PageviewSource } {
  if (sourceSent) return {};
  sourceSent = true;
  const source = remembered() ?? "direct";
  forget();
  return { source };
}

function withoutTheSourceInTheAddress(address: URL) {
  address.searchParams.delete(visitSourceParam);
  window.history.replaceState(window.history.state, "", address.pathname + address.search + address.hash);
}

function backFromSignIn(address: URL) {
  return address.searchParams.has("code");
}

function remember(source: VisitSource) {
  try {
    sessionStorage.setItem(storageKey, source);
  } catch {
    return;
  }
}

function remembered(): VisitSource | undefined {
  try {
    return visitSourceIn(sessionStorage.getItem(storageKey));
  } catch {
    return undefined;
  }
}

function forget() {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    return;
  }
}
