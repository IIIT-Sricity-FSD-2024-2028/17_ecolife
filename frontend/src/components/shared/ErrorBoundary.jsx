import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Tropos Frontend ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '360px',
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-lg, 8px)',
          border: '1px solid var(--color-border, #e5e7eb)',
          margin: '1.5rem',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '999px',
            background: 'var(--color-danger-bg, #fee2e2)',
            color: 'var(--color-danger, #ef4444)',
            marginBottom: '1rem',
          }}>
            <AlertCircle size={28} />
          </div>

          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: 'var(--color-text, #111827)',
          }}>
            Something went wrong in this view
          </h2>

          <p style={{
            color: 'var(--color-text-muted, #6b7280)',
            maxWidth: '480px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}>
            An unexpected error occurred while rendering this component. You can attempt to retry, reload the application, or return to the main dashboard.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={this.handleReset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} /> Try Again
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
            <a
              href="/"
              className="btn btn--secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              <Home size={16} /> Return to Home
            </a>
          </div>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details style={{ marginTop: '1.5rem', textAlign: 'left', maxWidth: '600px', fontSize: '0.75rem', color: '#991b1b', background: '#fef2f2', padding: '0.75rem', borderRadius: '4px', border: '1px solid #fecaca' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Technical Details</summary>
              <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
