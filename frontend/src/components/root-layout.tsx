import { Loading } from "@/components/loading";
import { Navbar, TabBar } from "@/components/navbar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { useSession } from "@/lib/queries";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

export function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isLoading, authenticated } = useSession();

  // The route guards only run on navigation. This catches a session that
  // expires while a page is open.
  useEffect(() => {
    if (!isLoading && !authenticated && !pathname.startsWith("/login")) {
      void navigate({ to: "/login" });
    }
  }, [authenticated, isLoading, pathname, navigate]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-[1720px] px-4 py-16 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <Loading />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {authenticated ? <Navbar /> : null}
      <main className="mx-auto w-full max-w-[1720px] px-4 pb-[calc(var(--bottom-inset)+1.5rem)] pt-5 sm:px-6 md:pb-[calc(var(--bottom-inset)+2rem)] md:pt-8 lg:px-8 xl:px-10 2xl:px-12">
        <Outlet />
      </main>
      {authenticated ? (
        <>
          <ScrollToTop />
          <TabBar />
        </>
      ) : null}
    </div>
  );
}
