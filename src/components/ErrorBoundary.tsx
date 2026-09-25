import { Component, type ReactNode } from "react";
import { Button } from "./ui";

/** Keeps a rendering bug in one page from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-20 max-w-md text-center">
                <h1 className="mt-4 font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-cream/80">{this.state.error.message}</p>
        <Button className="mt-6" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
