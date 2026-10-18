import { Component, type ContextType, type ReactNode } from "react";
import { ReportCaughtError } from "./browserAnalytics/reportCaughtError";

export type Failure = { focusWasOnPage: boolean };

type Props = { fallback: (failure: Failure) => ReactNode; children: ReactNode };

export class ErrorBoundary extends Component<Props, { failure: Failure | null }> {
  static contextType = ReportCaughtError;
  declare context: ContextType<typeof ReportCaughtError>;
  state: { failure: Failure | null } = { failure: null };

  static getDerivedStateFromError() {
    return { failure: { focusWasOnPage: focusIsOnPage() } };
  }

  componentDidCatch(error: unknown) {
    this.context(error);
  }

  render() {
    return this.state.failure ? this.props.fallback(this.state.failure) : this.props.children;
  }
}

function focusIsOnPage() {
  const focused = document.activeElement;
  return focused !== null && focused !== document.body;
}
