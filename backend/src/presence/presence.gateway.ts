// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\presence\presence.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PresenceUser {
  userId: string;
  nom: string;
  avatarUrl: string | null;
  socketId: string;
  isEditing: boolean;
}

// documentId → list of users currently in that document
const documentRooms = new Map<string, Map<string, PresenceUser>>();

// socketId → documentId  (so we can clean up on disconnect)
const socketToDocument = new Map<string, string>();

// documentId → userId who holds the edit lock (null = unlocked)
const editLocks = new Map<string, string | null>();

// ─── Gateway ──────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/presence',
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  // ── Connection: verify JWT from cookie or handshake auth ──────────────────

  async handleConnection(client: Socket) {
    try {
      // Token can come from cookie or from handshake.auth.token
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.cookie
          ?.split(';')
          .find((c) => c.trim().startsWith('access_token='))
          ?.split('=')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      // Attach user info to socket for later use
      (client as any).userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  // ── Disconnect: auto-cleanup — removes presence + releases lock ───────────

  handleDisconnect(client: Socket) {
    const documentId = socketToDocument.get(client.id);
    if (!documentId) return;

    this._leaveDocument(client, documentId);
  }

  // ── Join: user opens a document ───────────────────────────────────────────

  @SubscribeMessage('join-document')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { documentId: string; nom: string; avatarUrl: string | null },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;

    const { documentId, nom, avatarUrl } = payload;

    // Track which document this socket is in
    socketToDocument.set(client.id, documentId);

    // Join the socket.io room
    client.join(documentId);

    // Initialize room if needed
    if (!documentRooms.has(documentId)) {
      documentRooms.set(documentId, new Map());
    }

    const room = documentRooms.get(documentId)!;
    room.set(userId, {
      userId,
      nom,
      avatarUrl,
      socketId: client.id,
      isEditing: false,
    });

    // Broadcast updated presence list to everyone in the room
    this._broadcastPresence(documentId);

    // Send the current lock state to the joining user
    const lockHolder = editLocks.get(documentId) ?? null;
    client.emit('lock-state', {
      lockedBy: lockHolder ? room.get(lockHolder) ?? null : null,
    });
  }

  // ── Leave: user navigates away (explicit) ─────────────────────────────────

  @SubscribeMessage('leave-document')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { documentId: string },
  ) {
    this._leaveDocument(client, payload.documentId);
  }

  // ── Edit start: user clicks "Edit" button ─────────────────────────────────

  @SubscribeMessage('editing-start')
  handleEditStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { documentId: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;

    const { documentId } = payload;
    const currentLock = editLocks.get(documentId);

    // If already locked by someone else, deny
    if (currentLock && currentLock !== userId) {
      const room = documentRooms.get(documentId);
      const locker = room?.get(currentLock) ?? null;
      client.emit('lock-denied', { lockedBy: locker });
      return;
    }

    // Acquire the lock
    editLocks.set(documentId, userId);

    // Update user state in room
    const room = documentRooms.get(documentId);
    if (room?.has(userId)) {
      room.get(userId)!.isEditing = true;
    }

    // Broadcast lock acquired to everyone
    this._broadcastLock(documentId, userId);
    this._broadcastPresence(documentId);
  }

  // ── Edit stop: user clicks "Done Editing" or saves ────────────────────────

  @SubscribeMessage('editing-stop')
  handleEditStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { documentId: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;

    const { documentId } = payload;
    const currentLock = editLocks.get(documentId);

    // Only the lock holder can release it
    if (currentLock !== userId) return;

    editLocks.set(documentId, null);

    const room = documentRooms.get(documentId);
    if (room?.has(userId)) {
      room.get(userId)!.isEditing = false;
    }

    // Broadcast lock released
    this._broadcastLock(documentId, null);
    this._broadcastPresence(documentId);
  }

  // ── Document saved: notify others to reload content ───────────────────────

  @SubscribeMessage('document-saved')
  handleDocumentSaved(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { documentId: string },
  ) {
    const userId = (client as any).userId;
    // Notify everyone EXCEPT the sender
    client.to(payload.documentId).emit('document-updated', { by: userId });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _leaveDocument(client: Socket, documentId: string) {
    const userId = (client as any).userId;

    client.leave(documentId);
    socketToDocument.delete(client.id);

    const room = documentRooms.get(documentId);
    if (!room) return;

    room.delete(userId);

    // If this user held the lock, release it
    if (editLocks.get(documentId) === userId) {
      editLocks.set(documentId, null);
      this._broadcastLock(documentId, null);
    }

    // Clean up empty rooms
    if (room.size === 0) {
      documentRooms.delete(documentId);
      editLocks.delete(documentId);
    }

    this._broadcastPresence(documentId);
  }

  private _broadcastPresence(documentId: string) {
    const room = documentRooms.get(documentId);
    const users = room ? Array.from(room.values()) : [];
    this.server.to(documentId).emit('presence-update', { users });
  }

  private _broadcastLock(documentId: string, lockedByUserId: string | null) {
    const room = documentRooms.get(documentId);
    const locker =
      lockedByUserId && room ? (room.get(lockedByUserId) ?? null) : null;
    this.server.to(documentId).emit('lock-update', { lockedBy: locker });
  }
}