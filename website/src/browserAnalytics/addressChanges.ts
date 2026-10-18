type Listener = () => void;

const listeners = new Set<Listener>();

let watching = false;

export function onAddressChange(listener: Listener): () => void {
  watchTheAddress();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function watchTheAddress() {
  if (watching) return;
  watching = true;
  const { history } = window;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      original.apply(this, args);
      tellListeners();
    };
  }
  window.addEventListener("popstate", tellListeners);
  window.addEventListener("hashchange", tellListeners);
}

function tellListeners() {
  for (const listener of [...listeners]) listener();
}
