"use client";

import { useTranslations } from "next-intl";

export function WhatsappShareButton({ title, url }: { title: string; url: string }) {
  const t = useTranslations("listing");

  const text = encodeURIComponent(`${title} - ${url}`);
  const href = `https://wa.me/?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
    >
      {t("shareWhatsapp")}
    </a>
  );
}
