"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Socket } from "socket.io-client";
import { ConversationDetailDto, MessageDto } from "@marketplace/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { authApi, conversationsApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { createChatSocket } from "@/lib/socket";
import { formatXaf } from "@/lib/format";

export default function ConversationPage() {
  const t = useTranslations("messages");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [text, setText] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }

    let socket: Socket | null = null;

    async function init() {
      const [me, detail] = await Promise.all([
        authApi.me(tokens!.accessToken),
        conversationsApi.getDetail(tokens!.accessToken, conversationId),
      ]);
      setCurrentUserId(me.id);
      setConversation(detail);
      setMessages(detail.messages);
      void conversationsApi.markRead(tokens!.accessToken, conversationId);

      socket = createChatSocket(tokens!.accessToken);
      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        socket!.emit("joinConversation", { conversationId });
      });
      socket.on("disconnect", () => setIsConnected(false));
      socket.on("message", (message: MessageDto) => {
        setMessages((prev) => [...prev, message]);
      });
    }

    void init();

    return () => {
      socket?.disconnect();
    };
  }, [conversationId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content || !socketRef.current) return;
    socketRef.current.emit("sendMessage", { conversationId, content });
    setText("");
  }

  function handleSendOffer(event: React.FormEvent) {
    event.preventDefault();
    const amountXaf = Number(offerAmount);
    if (!amountXaf || !socketRef.current) return;
    socketRef.current.emit("sendOffer", { conversationId, amountXaf });
    setOfferAmount("");
    setShowOfferForm(false);
  }

  function respondOffer(messageId: string, accept: boolean) {
    socketRef.current?.emit("respondOffer", { conversationId, messageId, accept });
  }

  if (!conversation || !currentUserId) return null;

  const isBuyer = currentUserId === conversation.buyer.id;
  const isSeller = currentUserId === conversation.seller.id;
  const other = isBuyer ? conversation.seller : conversation.buyer;

  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between border-b border-clay-100 pb-3">
        <div>
          <p className="font-medium text-clay-900">
            {other.firstName} {other.lastName}
          </p>
          <Link
            href={`/annonces/${conversation.listingId}`}
            className="text-xs text-brand-600 hover:underline"
          >
            {conversation.listingTitle}
          </Link>
        </div>
        {!isConnected && <span className="text-xs text-clay-400">{t("connecting")}</span>}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.senderId === currentUserId}
            canRespond={isSeller}
            onRespond={respondOffer}
            t={t}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {showOfferForm ? (
        <form onSubmit={handleSendOffer} className="mt-3 flex gap-2">
          <input
            type="number"
            min={100}
            required
            value={offerAmount}
            onChange={(event) => setOfferAmount(event.target.value)}
            placeholder={t("offerAmountLabel")}
            className="flex-1 rounded-md border border-clay-100 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("send")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          {isBuyer && (
            <button
              type="button"
              onClick={() => setShowOfferForm(true)}
              className="shrink-0 rounded-md border border-brand-300 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              {t("makeOffer")}
            </button>
          )}
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("typePlaceholder")}
            className="flex-1 rounded-md border border-clay-100 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("send")}
          </button>
        </form>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  canRespond,
  onRespond,
  t,
}: {
  message: MessageDto;
  isOwn: boolean;
  canRespond: boolean;
  onRespond: (messageId: string, accept: boolean) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (message.type === "SYSTEM") {
    return <p className="text-center text-xs text-clay-400">{message.content}</p>;
  }

  if (message.type === "OFFER") {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <div className="max-w-xs rounded-xl2 border border-brand-200 bg-brand-50 p-3">
          <p className="font-semibold text-brand-700">
            {formatXaf(message.offerAmountXaf ?? 0)}
          </p>
          <p className="text-xs text-clay-500">
            {message.offerStatus === "PENDING"
              ? t("offerPending")
              : message.offerStatus === "ACCEPTED"
                ? t("offerAccepted")
                : t("offerRejected")}
          </p>
          {canRespond && !isOwn && message.offerStatus === "PENDING" && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onRespond(message.id, true)}
                className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                {t("acceptOffer")}
              </button>
              <button
                type="button"
                onClick={() => onRespond(message.id, false)}
                className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                {t("rejectOffer")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-xs rounded-xl2 px-3 py-2 text-sm ${
          isOwn ? "bg-brand-600 text-white" : "bg-clay-100 text-clay-900"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
