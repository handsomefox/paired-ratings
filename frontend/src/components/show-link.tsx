import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

declare module "@tanstack/history" {
  interface HistoryState {
    /**
     * The href of the page that opened a show page. While it equals the show
     * page's `from`, the entry before this one is that page, so Back can go
     * back in history and the router restores its scroll position.
     */
    linkedFrom?: string;
  }
}

type ShowLinkProps = {
  showId: number;
  children: ReactNode;
  className?: string;
  /** For a second link to the same show, such as the poster beside the title. */
  hidden?: boolean;
};

/** A link to a library show that remembers the current page as the way back. */
export function ShowLink({ showId, children, className, hidden }: ShowLinkProps) {
  const href = useLocation({ select: (location) => location.href });
  return (
    <Link
      to="/show/$showId"
      params={{ showId: String(showId) }}
      search={{ from: href }}
      state={{ linkedFrom: href }}
      className={className}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden ? true : undefined}
    >
      {children}
    </Link>
  );
}
