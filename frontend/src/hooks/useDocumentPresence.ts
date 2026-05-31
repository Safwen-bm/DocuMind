// frontend\src\hooks\useDocumentPresence.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresenceUser {
  userId: string;
  nom: string;
  avatarUrl: string | null;
  isEditing: boolean;
}

interface UseDocumentPresenceOptions {
  documentId: string;
  user: { id: string; nom: string; avatarUrl: string | null } | null;
  isEditing: boolean;
  onLockDenied?: (lockedBy: PresenceUser) => void;
  onDocumentUpdated?: () => void;
}

interface PresenceState {
  users: PresenceUser[];
  lockedBy: PresenceUser | null;
  isConnected: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentPresence({
  documentId,
  user,
  isEditing,
  onLockDenied,
  onDocumentUpdated,
}: UseDocumentPresenceOptions): {
  presence: PresenceState;
  emitSaved: () => void;
} {
  const socketRef = useRef<Socket | null>(null);
  const prevEditingRef = useRef(false);

  const [presence, setPresence] = useState<PresenceState>({
    users: [],
    lockedBy: null,
    isConnected: false,
  });

  // ── Connect once on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const socket = io(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/presence`,
      {
        withCredentials: true, // sends the httpOnly cookie automatically
        transports: ['websocket'],
      },
    );

    socketRef.current = socket;

    socket.on('connect', () => {
      setPresence((p) => ({ ...p, isConnected: true }));

      // Join the document room
      socket.emit('join-document', {
        documentId,
        nom: user.nom,
        avatarUrl: user.avatarUrl,
      });
    });

    socket.on('disconnect', () => {
      setPresence((p) => ({ ...p, isConnected: false }));
    });

    // Someone joined or left → updated user list
    socket.on('presence-update', ({ users }: { users: PresenceUser[] }) => {
      setPresence((p) => ({ ...p, users }));
    });

    // Lock acquired or released
    socket.on(
      'lock-update',
      ({ lockedBy }: { lockedBy: PresenceUser | null }) => {
        setPresence((p) => ({ ...p, lockedBy }));
      },
    );

    // Initial lock state on join
    socket.on(
      'lock-state',
      ({ lockedBy }: { lockedBy: PresenceUser | null }) => {
        setPresence((p) => ({ ...p, lockedBy }));
      },
    );

    // Server denied our edit request (document already locked)
    socket.on('lock-denied', ({ lockedBy }: { lockedBy: PresenceUser }) => {
      onLockDenied?.(lockedBy);
    });

    // Another user saved the document
    socket.on('document-updated', () => {
      onDocumentUpdated?.();
    });

    // Cleanup on unmount — auto-releases lock + removes from room
    return () => {
      socket.emit('leave-document', { documentId });
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, user?.id]);

  // ── React to isEditing changes ─────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !user) return;

    const wasEditing = prevEditingRef.current;

    if (isEditing && !wasEditing) {
      socket.emit('editing-start', { documentId });
    } else if (!isEditing && wasEditing) {
      socket.emit('editing-stop', { documentId });
    }

    prevEditingRef.current = isEditing;
  }, [isEditing, documentId, user]);

  // ── Call this right after a successful save ────────────────────────────────
  const emitSaved = useCallback(() => {
    socketRef.current?.emit('document-saved', { documentId });
  }, [documentId]);

  return { presence, emitSaved };
}