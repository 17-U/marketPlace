"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { NotificationDto } from "@marketplace/shared";
import { useRouter } from "@/i18n/navigation";
import { notificationsApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDto[] | null>(null);

  async function refresh(accessToken: string) {
    const list = await notificationsApi.findMine(accessToken);
    setNotifications(list);
  }

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    refresh(tokens.accessToken).catch(() => setNotifications([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleMarkRead(id: string) {
    const tokens = loadTokens();
    if (!tokens) return;
    await notificationsApi.markRead(tokens.accessToken, id);
    await refresh(tokens.accessToken);
  }

  async function handleMarkAllRead() {
    const tokens = loadTokens();
    if (!tokens) return;
    await notificationsApi.markAllRead(tokens.accessToken);
    await refresh(tokens.accessToken);
  }

  if (notifications === null) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-clay-900">{t("title")}</h1>
        {notifications.some((n) => !n.readAt) && (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="text-sm text-brand-600 hover:underline"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-center text-clay-500">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-clay-100 rounded-xl2 border border-clay-100 bg-white">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              onClick={() => !notification.readAt && void handleMarkRead(notification.id)}
              className={`cursor-pointer p-3 ${notification.readAt ? "" : "bg-brand-50"}`}
            >
              <p className="text-sm font-medium text-clay-900">{notification.title}</p>
              <p className="text-xs text-clay-500">{notification.body}</p>
              <p className="mt-1 text-xs text-clay-400">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
