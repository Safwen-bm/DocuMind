import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// userId → Set of socketIds (one user can have multiple tabs open)
const userSockets = new Map<string, Set<string>>();
// socketId → userId
const socketToUser = new Map<string, string>();

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  // ── Verify JWT on connect ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.cookie
          ?.split(';')
          .find((c) => c.trim().startsWith('access_token='))
          ?.split('=')[1];

      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const userId: string = payload.sub;
      (client as any).userId = userId;

      // Register socket under this user
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId)!.add(client.id);
      socketToUser.set(client.id, userId);

      // Each user joins their own private room keyed by userId
      client.join(`user:${userId}`);
    } catch {
      client.disconnect();
    }
  }

  // ── Cleanup on disconnect ─────────────────────────────────────────────────

  handleDisconnect(client: Socket) {
    const userId = socketToUser.get(client.id);
    if (!userId) return;

    socketToUser.delete(client.id);
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) userSockets.delete(userId);
    }
  }

  // ── Push a notification to a specific user (called by NotificationsService)

  pushToUser(userId: string, notification: any) {
    // Emits to ALL tabs/windows the user has open
    this.server.to(`user:${userId}`).emit('new-notification', notification);
  }
}