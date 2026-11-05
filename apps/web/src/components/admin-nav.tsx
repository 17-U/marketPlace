"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function AdminNav() {
  const t = useTranslations("admin.nav");

  const links = [
    { href: "/admin", label: t("dashboard") },
    { href: "/admin/listings", label: t("listings") },
    { href: "/admin/kyc", label: t("kyc") },
    { href: "/admin/disputes", label: t("disputes") },
    { href: "/admin/reports", label: t("reports") },
  ];

  return (
    <nav className="mb-4 flex gap-3 overflow-x-auto border-b border-clay-100 pb-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="shrink-0 whitespace-nowrap text-clay-600 hover:text-brand-700"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
