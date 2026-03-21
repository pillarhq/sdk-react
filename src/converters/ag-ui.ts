/**
 * Converts PillarChatMessage[] to AG-UI protocol message format.
 *
 * AG-UI has first-class ActivityMessage and ReasoningMessage roles, which
 * map naturally to our progressEvents. Tool-call progress becomes an
 * activity; thinking progress becomes a reasoning message.
 *
 * Usage:
 *   import { toAGUIMessages } from '@pillar-ai/react';
 *   const agMessages = toAGUIMessages(pillarMessages);
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
  PillarAGUIMessage,
  AGUIInputContent,
} from './types';
import type { ProgressEvent } from '@pillar-ai/sdk';

let _idCounter = 0;
function stableId(): string {
  return `pillar-agui-${Date.now()}-${_idCounter++}`;
}

export function toAGUIMessages(
  messages: PillarChatMessage[],
  _options?: ConverterOptions,
): PillarAGUIMessage[] {
  const result: PillarAGUIMessage[] = [];

  for (const msg of messages) {
    const id = msg.id ?? stableId();

    if (msg.role === 'user') {
      result.push(buildUserMessage(id, msg));
    } else {
      result.push(buildAssistantMessage(id, msg));

      if (msg.progressEvents) {
        result.push(...buildProgressMessages(msg.progressEvents));
      }
    }
  }

  return result;
}

function buildUserMessage(
  id: string,
  msg: PillarChatMessage,
): PillarAGUIMessage {
  if (!msg.images?.length) {
    return { id, role: 'user', content: msg.content };
  }

  const contentParts: AGUIInputContent[] = [
    { type: 'text', text: msg.content },
  ];

  for (const img of msg.images) {
    contentParts.push({ type: 'binary', mimeType: 'image/*', url: img.url });
  }

  return { id, role: 'user', content: contentParts };
}

function buildAssistantMessage(
  id: string,
  msg: PillarChatMessage,
): PillarAGUIMessage {
  return { id, role: 'assistant', content: msg.content || undefined };
}

function buildProgressMessages(
  events: ProgressEvent[],
): PillarAGUIMessage[] {
  const result: PillarAGUIMessage[] = [];

  for (const event of events) {
    if (event.status !== 'active') continue;

    if (event.kind === 'thinking' && event.text) {
      result.push({
        id: event.id ?? stableId(),
        role: 'reasoning',
        content: event.text,
      });
    } else {
      result.push({
        id: event.id ?? stableId(),
        role: 'activity',
        activityType: event.kind.toUpperCase(),
        content: {
          label: event.label ?? event.kind,
          ...(event.metadata ?? {}),
        },
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Convenience hook
// ---------------------------------------------------------------------------

export interface UsePillarChatAGUIReturn
  extends Omit<UsePillarChatReturn, 'messages'> {
  messages: PillarAGUIMessage[];
  rawMessages: PillarChatMessage[];
}

export function usePillarChatAGUI(
  options?: UsePillarChatOptions,
): UsePillarChatAGUIReturn {
  const chat = usePillarChat(options);
  const messages = useMemo(
    () => toAGUIMessages(chat.messages),
    [chat.messages],
  );

  return { ...chat, messages, rawMessages: chat.messages };
}
