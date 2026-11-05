"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    authApi
      .me(tokens.accessToken)
      .then((me) => setStatus(me.role === "ADMIN" ? "allowed" : "denied"))
      .catch(() => setStatus("denied"));
  }, [router]);

  if (status === "loading") return null;
  if (status === "denied") {
    return <p className="mx-auto max-w-lg px-4 py-10 text-center text-clay-500">{t("accessDenied")}</p>;
  }
  return <>{children}</>;
}
