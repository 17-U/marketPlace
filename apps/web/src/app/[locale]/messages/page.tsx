"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ConversationSummaryDto } from "@marketplace/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { conversationsApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

export default function MessagesPage() {
  const t = useTranslations("messages");
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummaryDto[] | null>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    conversationsApi
      .findMine(tokens.accessToken)
      .then(setConversations)
      .catch(() => setConversations([]));
  }, [router]);

  if (conversations === null) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("title")}</h1>

      {conversations.length === 0 ? (
        <div className="text-center text-clay-500">
          <p>{t("empty")}</p>
          <Link href="/recherche" className="mt-2 inline-block text-brand-600 hover:underline">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-clay-100 rounded-xl2 border border-clay-100 bg-white">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-3 hover:bg-clay-50"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-clay-100">
                  {conversation.listingCoverPhotoUrl ? (
                    <Image
                      src={conversation.listingCoverPhotoUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl">📦</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-clay-900">
                    {conversation.listingTitle}
                  </p>
                  <p className="truncate text-xs text-clay-500">
                    {conversation.lastMessage?.content ??
                      (conversation.lastMessage?.type === "OFFER" ? t("offerPending") : "")}
                  </p>
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-medium text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
