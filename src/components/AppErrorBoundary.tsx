import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('VELZICO screen error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private goHome = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center p-5">
        <div className="card w-full p-7 text-center md:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-950">This screen hit a snag</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            Your information is safe. Retry the screen, or return home and continue working.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button onClick={this.reset} className="btn-secondary">
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
            <button onClick={this.goHome} className="btn-primary">
              <Home className="h-4 w-4" /> Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
