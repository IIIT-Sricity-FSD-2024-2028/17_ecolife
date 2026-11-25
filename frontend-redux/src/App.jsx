import React from 'react';
import { ErrorBoundary } from './components/shell/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DialogProvider } from './components/ui/Dialogs.jsx';
import { AppRouter } from './app/routes/AppRouter';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <DialogProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </DialogProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
