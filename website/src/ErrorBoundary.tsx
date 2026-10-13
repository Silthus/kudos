import { Component, type ReactNode } from "react";

export type Failure = { focusWasOnPage: boolean };

type Props = { fallback: (failure: Failure) => ReactNode; children: ReactNode };

export class ErrorBoundary extends Component<Props, { failure: Failure | null }> {
  state: { failure: Failure | null } = { failure: null };

  static getDerivedStateFromError() {
    return { failure: { focusWasOnPage: focusIsOnPage() } };
  }

  render() {
    return this.state.failure ? this.props.fallback(this.state.failure) : this.props.children;
  }
}

function focusIsOnPage() {
  const focused = document.activeElement;
  return focused !== null && focused !== document.body;
}
