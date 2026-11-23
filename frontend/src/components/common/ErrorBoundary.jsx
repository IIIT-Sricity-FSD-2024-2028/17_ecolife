import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error' };
  }

  componentDidCatch(error, info) {
    console.error('Tropos ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen ambient-workspace flex items-center justify-center p-6">
          <div className="glass-card p-6 max-w-md w-full space-y-3 text-center">
            <h2 className="text-base font-bold text-text">Something went wrong</h2>
            <p className="text-xs text-text">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-9 px-4 rounded-xl btn-primary text-xs font-semibold"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
