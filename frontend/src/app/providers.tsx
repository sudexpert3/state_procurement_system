import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { queryClient } from "@/shared/api/query-client";
import { Button } from "@/shared/ui/kit/button";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      // onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => (
        <div className="flex flex-col items-center gap-4">
          <h1>Произошла ошибка!</h1>
          <Button
            onClick={() => {
              resetErrorBoundary();
              window.location.assign(window.location.origin);
            }}>
            Перезагрузить
          </Button>
        </div>
      )}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ErrorBoundary>
  );
};
