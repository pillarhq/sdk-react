/**
 * Converts PillarChatMessage[] to AI SDK UIMessage-compatible format.
 *
 * Usage:
 *   import { toUIMessages } from '@pillar-ai/react';
 *   import type { UIMessage } from 'ai';
 *   const messages: UIMessage[] = toUIMessages(pillarMessages);
 *
 * Or use the hook:
 *   import { usePillarChatUIMessages } from '@pillar-ai/react';
 *   const { messages, sendMessage } = usePillarChatUIMessages();
 */

import { useMemo } from 'react';
import {
  usePillarChat,
  type PillarChatMessage,
  type UsePillarChatOptions,
  type UsePillarChatReturn,
} from '../hooks/usePillarChat';
import type {
  ConverterOptions,
  PillarUIMessage,
  PillarUIMessagePart,
} from './types';

let _idCounter = 0;
function stableId(): string {
  return `pillar-${Date.now()}-${_idCounter++}`;
}

export function toUIMessages(
  messages: PillarChatMessage[],
  options?: ConverterOptions,
): PillarUIMessage[] {
  return messages.map((msg) => ({
    id: msg.id ?? stableId(),
    role: msg.role,
    content: msg.content ?? '',
    parts: buildUIParts(msg, options),
    createdAt: new Date(),
  }));
}

function buildUIParts(
  msg: PillarChatMessage,
  options?: ConverterOptions,
): PillarUIMessagePart[] {
  const parts: PillarUIMessagePart[] = [];

  if (msg.content) {
    parts.push({ type: 'text', text: msg.content });
  }

  if (msg.images) {
    for (const img of msg.images) {
      parts.push({ type: 'file', url: img.url, mediaType: 'image/*' });
    }
  }

  if (msg.sources) {
    for (const source of msg.sources) {
      const url = options?.helpCenterUrl
        ? `${options.helpCenterUrl}/articles/${source.slug}`
        : undefined;

      if (url) {
        parts.push({
          type: 'source-url',
          sourceId: source.id,
          url,
          title: source.title,
        });
      } else {
        parts.push({ type: 'text', text: `[Source: ${source.title}]` });
      }
    }
  }

  if (msg.progressEvents) {
    for (const event of msg.progressEvents) {
      if (event.status !== 'active') continue;

      if (event.kind === 'thinking' && event.text) {
        parts.push({ type: 'reasoning', text: event.text });
      } else {
        parts.push({ type: 'step-start' });
      }
    }
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', text: '' });
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Convenience hook
// ---------------------------------------------------------------------------

export interface UsePillarChatUIMessagesReturn
  extends Omit<UsePillarChatReturn, 'messages'> {
  messages: PillarUIMessage[];
  rawMessages: PillarChatMessage[];
}

export function usePillarChatUIMessages(
  options?: UsePillarChatOptions & ConverterOptions,
): UsePillarChatUIMessagesReturn {
  const chat = usePillarChat(options);
  const converterOpts: ConverterOptions | undefined = options?.helpCenterUrl
    ? { helpCenterUrl: options.helpCenterUrl }
    : undefined;
  const messages = useMemo(
    () => toUIMessages(chat.messages, converterOpts),
    [chat.messages, converterOpts?.helpCenterUrl],
  );

  return { ...chat, messages, rawMessages: chat.messages };
}
