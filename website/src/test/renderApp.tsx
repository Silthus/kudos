import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";
import { App } from "../App";
import type { ShellState } from "../shell";

export function renderApp(visitor: ShellState) {
  const actions = { signIn: vi.fn(), signOut: vi.fn() };
  const user = userEvent.setup();
  const appFor = (state: ShellState) => (
    <StrictMode>
      <App visitor={state} actions={actions} />
    </StrictMode>
  );
  const view = render(appFor(visitor));
  const showVisitor = (next: ShellState) => view.rerender(appFor(next));
  return { ...view, actions, user, showVisitor };
}
