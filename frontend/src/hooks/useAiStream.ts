// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\hooks\useAiStream.ts

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatSource } from '@/lib/ai.api';

interface UseAiStreamOptions {
  enabled: boolean; // only connect when user is authenticated
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (data: { sources: ChatSource[]; conversationId: string }) => void;
  onConversationId: (conversationId: string) => void;
  onError: (message: string) => void;
}

export function useAiStream({ enabled }: UseAiStreamOptions) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef<StreamCallbacks | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = io(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/ai-stream`,
      {
        withCredentials: true, // sends httpOnly cookie automatically
        transports: ['websocket'],
      },
    );

    socketRef.current = socket;

    socket.on('ai-token', ({ token }: { token: string }) => {
      callbacksRef.current?.onToken(token);
    });

    socket.on('ai-done', (data: { sources: ChatSource[]; conversationId: string }) => {
      callbacksRef.current?.onDone(data);
    });

    socket.on('ai-conversation-id', ({ conversationId }: { conversationId: string }) => {
      callbacksRef.current?.onConversationId(conversationId);
    });

    socket.on('ai-error', ({ message }: { message: string }) => {
      callbacksRef.current?.onError(message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  // Call this to start a streaming chat request
  const streamChat = useCallback((
    payload: {
      workspaceId: string;
      question: string;
      docId?: string;
      conversationId?: string;
      mode: 'document' | 'workspace';
    },
    callbacks: StreamCallbacks,
  ) => {
    callbacksRef.current = callbacks;
    socketRef.current?.emit('chat-stream', payload);
  }, []);

  return { streamChat };
}