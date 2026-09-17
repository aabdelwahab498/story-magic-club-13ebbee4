import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Short, user-facing name of the section, already localized. */
  sectionLabel: string;
  /** Optional localized recovery hint. */
  hint?: string;
  /** Localized retry button label; omit to hide the button. */
  retryLabel?: string;
  onRetry?: () => void;
}

interface State {
  failed: boolean;
}

/**
 * Localized boundary around one high-risk generated-content section
 * (story plan preview, story viewer, illustration gallery, audio controls,
 * export controls).
 *
 * A malformed optional field degrades ONLY that section — the AIStoryteller
 * route stays mounted and the user keeps their story, media and form state.
 * The underlying error is still reported to the console so programming errors
 * remain visible in development and test runs.
 */
class SectionErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[section:${this.props.sectionLabel}] render failed`, error, info?.componentStack);
  }

  private reset = () => {
    this.setState({ failed: false });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        role="alert"
        className="mx-auto max-w-3xl my-3 p-4 rounded-2xl border border-amber-400/50 bg-amber-500/10 text-left rtl:text-right"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground dark:text-white">{this.props.sectionLabel}</p>
            {this.props.hint && (
              <p className="text-xs text-muted-foreground dark:text-white/70 mt-1">{this.props.hint}</p>
            )}
            {this.props.retryLabel && (
              <button
                type="button"
                onClick={this.reset}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {this.props.retryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default SectionErrorBoundary;
