"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installation PWA best-effort: un échec n'empêche pas l'utilisation du site.
      });
    }
  }, []);

  return null;
}
