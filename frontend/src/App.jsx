import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

export default function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </AppProviders>
  );
}
