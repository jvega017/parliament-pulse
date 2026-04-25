import { useEffect } from "react";
import { applyTheme, readTheme } from "./theme";

// Effect-only component that applies the persisted theme on mount.
export function ThemeBoot(): null {
  useEffect(() => {
    applyTheme(readTheme());
  }, []);
  return null;
}
