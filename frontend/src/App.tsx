import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { registerUnauthorizedHandler } from "./lib/api";
import { queryKeys, shouldRetry } from "./lib/queries";
import { createAppRouter } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});

// Any 401 means the cookie is gone. Refetching the session flips
// `authenticated`, and RootLayout sends the reader to the login page.
registerUnauthorizedHandler(() => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.session });
});

const router = createAppRouter(queryClient);

export function App(): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster richColors />
        {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
