import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { JwtPayload } from "../auth/types/jwt-payload.type";
import { ConversationsService } from "./conversations.service";

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

@WebSocketGateway({
  namespace: "/chat",
  cors: { origin: process.env.WEB_URL ?? "http://localhost:3000", credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly conversations: ConversationsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>("jwt.accessSecret"),
      });
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client déconnecté: ${client.data.userId ?? "inconnu"}`);
  }

  @SubscribeMessage("joinConversation")
  async handleJoin(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId: string = client.data.userId;
    const allowed = await this.conversations.isParticipant(userId, data.conversationId);
    if (!allowed) {
      client.emit("error", { message: "Accès refusé à cette conversation" });
      return;
    }
    await client.join(conversationRoom(data.conversationId));
  }

  @SubscribeMessage("sendMessage")
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; content: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId: string = client.data.userId;
    const content = (data.content ?? "").trim();

    if (!content || content.length > 2000) {
      client.emit("error", { message: "Message invalide" });
      return;
    }

    try {
      const message = await this.conversations.sendMessage(userId, data.conversationId, content);
      this.server.to(conversationRoom(data.conversationId)).emit("message", message);
    } catch (error) {
      client.emit("error", { message: error instanceof Error ? error.message : "Erreur" });
    }
  }

  @SubscribeMessage("sendOffer")
  async handleSendOffer(
    @MessageBody() data: { conversationId: string; amountXaf: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId: string = client.data.userId;

    if (!Number.isInteger(data.amountXaf) || data.amountXaf < 100 || data.amountXaf > 50_000_000) {
      client.emit("error", { message: "Montant d'offre invalide" });
      return;
    }

    try {
      const message = await this.conversations.sendOffer(userId, data.conversationId, data.amountXaf);
      this.server.to(conversationRoom(data.conversationId)).emit("message", message);
    } catch (error) {
      client.emit("error", { message: error instanceof Error ? error.message : "Erreur" });
    }
  }

  @SubscribeMessage("respondOffer")
  async handleRespondOffer(
    @MessageBody() data: { conversationId: string; messageId: string; accept: boolean },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId: string = client.data.userId;

    try {
      const { offer, system } = await this.conversations.respondToOffer(
        userId,
        data.conversationId,
        data.messageId,
        !!data.accept,
      );
      this.server.to(conversationRoom(data.conversationId)).emit("message", offer);
      this.server.to(conversationRoom(data.conversationId)).emit("message", system);
    } catch (error) {
      client.emit("error", { message: error instanceof Error ? error.message : "Erreur" });
    }
  }
}
