// Observability bootstrap.
//
// Sentry integration is gated on VITE_SENTRY_DSN. When the env var is unset
// (the common case in dev and during initial deploy), this module installs a
// minimal global error handler that logs to console only — no third-party
// network calls. To activate Sentry:
//   1. Create a project at sentry.io and copy the DSN
//   2. Add VITE_SENTRY_DSN=https://...@sentry.io/... to the build env
//   3. Add @sentry/browser as a dependency (deferred to keep the bundle slim)
//
// The wrapper below intentionally does NOT import @sentry/browser at the top
// level so unconfigured builds stay light.

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

interface SentryShape {
  init: (options: Record<string, unknown>) => void;
  captureException: (e: unknown) => void;
}

let sentry: SentryShape | null = null;

export function initSentry(): void {
  if (typeof window === "undefined") return;

  if (DSN) {
    // Lazy import — only fetched when DSN is set. The variable indirection
    // stops Vite from resolving the bare module spec at build time when the
    // package is not installed.
    const sentryModule: string = "@sentry/browser";
    import(/* @vite-ignore */ sentryModule)
      .then((mod) => {
        sentry = mod as unknown as SentryShape;
        sentry.init({
          dsn: DSN,
          tracesSampleRate: 0.1,
          environment: import.meta.env.MODE,
          release: `parliament-pulse@${import.meta.env.VITE_APP_VERSION ?? "0.0.0"}`,
        });
      })
      .catch((err) => {
        console.warn("Sentry not loaded; install @sentry/browser to activate", err);
      });
  }

  // Always install a fallback error handler so silent failures still surface.
  window.addEventListener("error", (e: ErrorEvent) => {
    if (sentry) {
      sentry.captureException(e.error ?? e.message);
    } else {
      console.error("[uncaught]", e.error ?? e.message);
    }
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    if (sentry) {
      sentry.captureException(e.reason);
    } else {
      console.error("[unhandled rejection]", e.reason);
    }
  });
}

export function captureException(e: unknown): void {
  if (sentry) sentry.captureException(e);
  else console.error("[exception]", e);
}
