import * as Sentry from "@sentry/node";

let initialized = false;

// No-op tant que SENTRY_DSN n'est pas renseigné (dev par défaut). En
// production, définir SENTRY_DSN active la capture d'erreurs sans aucun
// autre changement de code.
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}
