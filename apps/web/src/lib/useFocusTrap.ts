import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Minimal focus trap.
 * - Stores the element that was focused before the trap activated
 * - Moves focus into the ref'd container on activation
 * - Loops Tab / Shift+Tab inside the container
 * - Restores focus to the original element when deactivated
 *
 * Call with `active=true` while the dialog / drawer is open.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus the first sensible element (heading with tabIndex=-1 or first focusable).
    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el.getClientRects().length > 0,
      );

    const all = focusables();
    if (all.length > 0) {
      (all[0] as HTMLElement).focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", onKey);

    return () => {
      container.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [containerRef, active]);
}
