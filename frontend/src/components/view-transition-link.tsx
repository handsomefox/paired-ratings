import { isModifiedClick, withViewTransition } from "@/lib/view-transitions";
import { Link, type LinkComponentProps, useRouter } from "@tanstack/react-router";
import type { MouseEvent } from "react";

type ViewTransitionLinkProps = LinkComponentProps;

export function ViewTransitionLink({
  onClick,
  children,
  preload = false,
  ...props
}: ViewTransitionLinkProps) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event.nativeEvent)) {
      return;
    }
    if (!("startViewTransition" in document)) {
      return;
    }
    event.preventDefault();
    withViewTransition(() => {
      router.navigate({
        to: props.to,
        params: props.params,
        search: props.search,
        hash: props.hash,
        state: props.state,
        replace: props.replace,
      });
    });
  };

  return (
    <Link {...props} preload={preload} onClick={handleClick}>
      {children}
    </Link>
  );
}
