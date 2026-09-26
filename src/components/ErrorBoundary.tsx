import { Component, type ReactNode } from "react";
import { Button } from "./ui";

/**
 * Keeps a rendering bug in one page from blanking the whole app. Around a window's page the world
 * stays standing and the window says what happened; `fallback` replaces that for smaller pieces.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="mx-auto mt-12 max-w-md text-center text-ink">
        <h2 className="font-display text-2xl font-medium">Something went wrong</h2>
        <p className="mt-2 text-sm text-ink/75">This page couldn't load. Reload it, or close the window and carry on in the garden.</p>
        <Button className="mt-6" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
