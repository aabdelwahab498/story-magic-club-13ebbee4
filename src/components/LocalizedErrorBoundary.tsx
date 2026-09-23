import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  sectionName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LocalizedErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[LocalizedErrorBoundary:${this.props.sectionName || 'section'}] caught error:`, error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground dark:text-white my-3 text-center">
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">
            {this.props.fallbackTitle || 'Section Temporarily Unavailable'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {this.props.fallbackMessage || 'This section could not be rendered right now. The rest of your story remains safe.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-3 py-1.5 rounded-full bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
