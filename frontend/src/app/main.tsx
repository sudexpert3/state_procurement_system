import "./global.css";

import { StrictMode, Suspense } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { RouterProvider } from "react-router";

import { queryClient } from "@/shared/api/query-client";
import { Button } from "@/shared/ui/kit/button";

import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <RouterProvider router={router} />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
