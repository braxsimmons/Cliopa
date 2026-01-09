import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`PageErrorBoundary caught error in ${this.props.pageName || 'page'}:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoBack = () => {
    window.history.back();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="max-w-md w-full bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-lg text-[var(--color-text)]">
                Page Error
              </CardTitle>
              <CardDescription className="text-[var(--color-subtext)]">
                {this.props.pageName
                  ? `Something went wrong loading ${this.props.pageName}.`
                  : "Something went wrong loading this page."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {import.meta.env.DEV && this.state.error && (
                <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3 mb-4">
                  <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <p className="text-sm text-[var(--color-subtext)] text-center">
                Try again or go back to the previous page.
              </p>
            </CardContent>

            <CardFooter className="flex gap-2 justify-center">
              <Button
                onClick={this.handleRetry}
                variant="default"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoBack}
                variant="outline"
                size="sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PageErrorBoundary;
