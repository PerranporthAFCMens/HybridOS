import { Component, type ReactNode } from 'react';

/** If a screen breaks, say so in words (and why) instead of leaving a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center" role="alert">
        <p>Something went wrong on this page.</p>
        <p className="muted small">{this.state.error.message}</p>
        <p><a href={window.location.href}>Try again</a></p>
      </div>
    );
  }
}
