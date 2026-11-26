import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-background p-6">
          <section className="max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
            <h1 className="text-xl font-semibold">This page could not open</h1>
            <p className="text-sm text-muted-foreground">
              The page may have updated while this tab was open. Reload to get the latest version, or return to the home page.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <a className="rounded-md border px-4 py-2 text-sm font-medium" href="/home">
                Go to home
              </a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
