/**
 * usePillarChat Hook
 * Headless chat with streaming, image upload, and conversation management.
 * Use this to build custom chat UIs without the Pillar panel.
 */

import { useState, useRef, useCallback } from 'react';
import {
  getApiClient,
  getPillarInstance,
  normalizeToolResult,
  type ChatImage,
  type ImageUploadResponse,
  type ArticleSummary,
  type ProgressEvent,
  type ToolRequest,
} from '@pillar-ai/sdk';
import { usePillarContext } from '../PillarProvider';

export interface PillarChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  images?: ChatImage[];
  sources?: ArticleSummary[];
  progressEvents?: ProgressEvent[];
}

export interface UsePillarChatOptions {
  /** Resume an existing conversation by ID. */
  conversationId?: string;
  /** Called when a chat error occurs. */
  onError?: (error: Error) => void;
}

export interface UsePillarChatReturn {
  messages: PillarChatMessage[];
  sendMessage: (text: string, opts?: { images?: ChatImage[] }) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  uploadImage: (file: File) => Promise<ImageUploadResponse>;
  stop: () => void;
  reset: () => void;
  conversationId: string | null;
}

export function usePillarChat(options: UsePillarChatOptions = {}): UsePillarChatReturn {
  const { isReady } = usePillarContext();

  const [messages, setMessages] = useState<PillarChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId ?? null,
  );

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string, opts?: { images?: ChatImage[] }) => {
      const api = getApiClient();
      if (!api) {
        const err = new Error('Pillar SDK is not initialized');
        setError(err);
        options.onError?.(err);
        return;
      }

      setError(null);
      setIsLoading(true);

      const userMsg: PillarChatMessage = {
        role: 'user',
        content: text,
        images: opts?.images,
      };

      setMessages((prev) => [...prev, userMsg]);

      const assistantIdx = { current: -1 };
      const abortController = new AbortController();
      abortRef.current = abortController;

      let convId = conversationId ?? crypto.randomUUID();
      if (!conversationId) {
        setConversationId(convId);
      }

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        setMessages((prev) => {
          assistantIdx.current = prev.length;
          return [...prev, { role: 'assistant', content: '' }];
        });

        const response = await api.chat({
          message: text,
          history,
          images: opts?.images,
          existingConversationId: convId,
          signal: abortController.signal,
          onChunk: (token) => {
            setMessages((prev) => {
              const idx = assistantIdx.current;
              if (idx < 0 || idx >= prev.length) return prev;
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                content: updated[idx].content + token,
              };
              return updated;
            });
          },
          onProgress: (event) => {
            setMessages((prev) => {
              const idx = assistantIdx.current;
              if (idx < 0 || idx >= prev.length) return prev;
              const updated = [...prev];
              const existing = updated[idx].progressEvents ?? [];
              updated[idx] = {
                ...updated[idx],
                progressEvents: [...existing, event],
              };
              return updated;
            });
          },
          onConversationStarted: (serverConvId, assistantMessageId) => {
            if (serverConvId) {
              convId = serverConvId;
              setConversationId(serverConvId);
            }
            if (assistantMessageId) {
              setMessages((prev) => {
                const idx = assistantIdx.current;
                if (idx < 0 || idx >= prev.length) return prev;
                const updated = [...prev];
                updated[idx] = { ...updated[idx], id: assistantMessageId };
                return updated;
              });
            }
          },
          onActionRequest: async (request: ToolRequest) => {
            const pillar = getPillarInstance();
            if (!pillar) {
              await api.mcp.sendActionResult(
                request.action_name,
                { success: false, error: 'SDK not initialized' },
                request.tool_call_id,
              );
              return;
            }

            try {
              const handler = pillar.getHandler(request.action_name);
              if (!handler) {
                throw new Error(
                  `No handler registered for action "${request.action_name}". ` +
                    `Register one with pillar.defineTool() or usePillarTool().`,
                );
              }

              const raw = await Promise.resolve(handler(request.parameters));
              const normalized = normalizeToolResult(raw);

              await api.mcp.sendActionResult(
                request.action_name,
                normalized,
                request.tool_call_id,
              );
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              await api.mcp.sendActionResult(
                request.action_name,
                { success: false, error: errorMessage },
                request.tool_call_id,
              );
            }
          },
        });

        setMessages((prev) => {
          const idx = assistantIdx.current;
          if (idx < 0 || idx >= prev.length) return prev;
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            content: updated[idx].content || response.message,
            sources: response.sources,
            id: updated[idx].id ?? response.messageId,
          };
          return updated;
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const chatError = err instanceof Error ? err : new Error(String(err));
        setError(chatError);
        options.onError?.(chatError);
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [messages, conversationId, isReady, options.onError],
  );

  const uploadImage = useCallback(async (file: File): Promise<ImageUploadResponse> => {
    const api = getApiClient();
    if (!api) throw new Error('Pillar SDK is not initialized');
    return api.uploadImage(file);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setConversationId(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    uploadImage,
    stop,
    reset,
    conversationId,
  };
}
