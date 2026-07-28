import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional short label so the message tells the user what failed. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Prevents a single failing component (e.g. a header widget) from blanking the
 * whole application. Shows a readable message plus a retry button instead.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", this.props.label ?? "app", error);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto my-6 max-w-md rounded-2xl border border-destructive/30 bg-card/90 p-5 text-center shadow-sm">
        <h2 className="mb-1 text-base font-bold text-foreground">
          Something went wrong
        </h2>
        <p className="mb-3 break-words text-xs text-muted-foreground">
          {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    );
  }
}
