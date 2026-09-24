import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
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
        <TriangleAlert className="mx-auto h-8 w-8 text-danger" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-sm text-text-2">{this.state.error.message}</p>
        <Button className="mt-6" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
