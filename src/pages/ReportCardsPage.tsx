import React from "react";
import { ReportCardDashboard } from "@/components/audit/ReportCardDashboard";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Report Cards error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-xl font-bold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-red-700 mb-4">
              The Report Cards page encountered an error. This usually means the database
              tables haven't been created yet.
            </p>
            <div className="p-4 bg-white rounded border border-red-200">
              <p className="font-semibold mb-2">Quick Fix:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Open <code className="bg-red-100 px-1 py-0.5 rounded">QUICK_FIX.md</code></li>
                <li>Follow the 4-step instructions to apply the database migration</li>
                <li>Refresh this page</li>
              </ol>
            </div>
            {this.state.error && (
              <details className="mt-4">
                <summary className="text-sm text-red-600 cursor-pointer">Technical Details</summary>
                <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ReportCardsPage = () => {
  return (
    <ErrorBoundary>
      <ReportCardDashboard />
    </ErrorBoundary>
  );
};

export default ReportCardsPage;
