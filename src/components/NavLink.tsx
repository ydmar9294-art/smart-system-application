import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { sanitizeNavigationTarget } from "@/lib/safeNavigation";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const safeTo = useMemo(
      () => (typeof to === 'string' ? sanitizeNavigationTarget(to) : to),
      [to]
    );

    return (
      <RouterNavLink
        ref={ref}
        to={safeTo}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
