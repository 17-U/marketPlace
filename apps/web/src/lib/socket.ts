import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function createChatSocket(accessToken: string): Socket {
  return io(`${API_URL}/chat`, {
    auth: { token: accessToken },
    transports: ["websocket"],
  });
}
