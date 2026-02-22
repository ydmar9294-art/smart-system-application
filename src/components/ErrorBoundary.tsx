/**
 * ErrorBoundary - Catches React render errors gracefully
 * Prevents entire app crash from a single component failure
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Structured error logging for production monitoring
    const errorData = {
      component: errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown',
      message: error.message,
      stack: error.stack?.substring(0, 500),
    };
    console.error('[ErrorBoundary] Caught error:', JSON.stringify(errorData));
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center" dir="rtl">
          <div className="bg-destructive/10 text-destructive rounded-2xl p-6 max-w-md">
            <h3 className="font-black text-lg mb-2">حدث خطأ غير متوقع</h3>
            <p className="text-sm opacity-80 mb-4">
              {this.state.error?.message || 'حدث خطأ أثناء تحميل هذا القسم'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2 bg-destructive text-destructive-foreground rounded-xl font-bold text-sm"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
