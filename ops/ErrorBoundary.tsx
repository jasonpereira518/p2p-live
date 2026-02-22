/**
 * Error boundary for ops dashboards so crashes show a friendly message and console points to the failing component.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  pageName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class OpsErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[OpsErrorBoundary] ${this.props.pageName} failed:`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
            <h2 className="text-lg font-bold text-gray-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-gray-600">
              The {this.props.pageName} dashboard failed to load. Check the console for details.
            </p>
            <p className="mt-1 text-xs text-gray-500 font-mono truncate" title={this.state.error.message}>
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 rounded-lg bg-p2p-blue text-white text-sm font-medium hover:bg-p2p-blue/90 focus:outline-none focus:ring-2 focus:ring-p2p-blue"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
