import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

interface UseNotificationsSocketOptions {
  // Pass false when there's no authenticated user yet
  enabled: boolean;
}

export function useNotificationsSocket({ enabled }: UseNotificationsSocketOptions) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = io(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/notifications`,
      {
        withCredentials: true, // sends httpOnly cookie automatically
        transports: ['websocket'],
      },
    );

    socketRef.current = socket;

    socket.on('new-notification', (notification) => {
      // 1. Inject the new notification into the existing list cache
      queryClient.setQueryData<any[]>(['notifications'], (old = []) => [
        notification,
        ...old,
      ]);

      // 2. Bump the unread count by 1 — no refetch needed
      queryClient.setQueryData<{ count: number }>(
        ['notifications-count'],
        (old) => ({ count: (old?.count ?? 0) + 1 }),
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, queryClient]);
}