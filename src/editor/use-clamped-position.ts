import { useLayoutEffect, useState, type RefObject } from "react";

const VIEWPORT_MARGIN = 8;

// Table popovers are positioned from a click/hover coordinate with no
// awareness of the popover's own size, so one opened near the window's
// bottom or right edge renders partially off-screen (confirmed via live
// testing: right-clicking a cell in a table's last visible row cut the
// context menu off at the bottom). useLayoutEffect (not useEffect) runs
// before paint, so the reposition happens in the same frame as the
// initial render — no visible flash-then-jump.
export function useClampedPosition(
  ref: RefObject<HTMLElement | null>,
  desired: { top: number; left: number },
): { top: number; left: number } {
  const [position, setPosition] = useState(desired);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      setPosition(desired);
      return;
    }
    const rect = el.getBoundingClientRect();
    const maxTop = window.innerHeight - rect.height - VIEWPORT_MARGIN;
    const maxLeft = window.innerWidth - rect.width - VIEWPORT_MARGIN;
    setPosition({
      top: Math.max(VIEWPORT_MARGIN, Math.min(desired.top, maxTop)),
      left: Math.max(VIEWPORT_MARGIN, Math.min(desired.left, maxLeft)),
    });
  }, [ref, desired.top, desired.left]);

  return position;
}
