import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RefreshCw, ArrowLeft, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  level?: 'root' | 'page';
  pageName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Universal React Error Boundary preventing application crashes.
 * Catches runtime errors in components, keeps navigation alive, and provides
 * recovery options (Try again, Go back, Return to POS, and Safe State Reset).
 */
export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleGoBack = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/pos';
    }
  };

  private handleClearStorageAndReload = () => {
    try {
      const keys = ['joshi_mangodi_ops_state_v7', 'joshi_mangodi_ops_state_v6', 'joshi_mangodi_ops_state_v5'];
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Storage clearance failed:', e);
    }
    window.location.href = '/pos';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isPageLevel = this.props.level === 'page';

      return (
        <div
          className={`${
            isPageLevel
              ? 'p-4 sm:p-8 max-w-4xl mx-auto my-6'
              : 'min-h-screen flex items-center justify-center p-4 sm:p-6 bg-surface text-ink'
          }`}
        >
          <div className="w-full bg-white rounded-2xl border border-danger/30 shadow-lg p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-danger-soft text-danger shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-ink">
                    {this.props.pageName ? `${this.props.pageName} Page Encountered an Issue` : 'Application Error Prevented Shutdown'}
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-danger-soft text-danger uppercase">
                    Protected
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-ink-muted mt-1">
                  The error was caught safely. The rest of the site is working properly, and your data is safe.
                </p>

                {this.state.error && (
                  <div className="mt-3.5 p-3 rounded-xl bg-surface border border-border text-xs font-mono text-danger break-words">
                    <strong>Error:</strong> {this.state.error.message || String(this.state.error)}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 mt-5">
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="jm-btn-primary flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <RefreshCw size={14} />
                    <span>Try Again</span>
                  </button>

                  <button
                    type="button"
                    onClick={this.handleGoBack}
                    className="jm-btn-secondary flex items-center gap-1.5 cursor-pointer text-xs"
                    title="Return to the previous screen"
                  >
                    <ArrowLeft size={14} />
                    <span>Go Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      this.setState({ hasError: false, error: null, errorInfo: null });
                      window.location.href = '/pos';
                    }}
                    className="jm-btn-secondary flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Home size={14} />
                    <span>Go to POS Counter</span>
                  </button>

                  <button
                    type="button"
                    onClick={this.handleClearStorageAndReload}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-danger/30 text-danger hover:bg-danger-soft transition cursor-pointer ml-auto"
                    title="Reset cached state to default clean factory preset"
                  >
                    <RotateCcw size={12} className="inline mr-1" />
                    Reset Cached State
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
