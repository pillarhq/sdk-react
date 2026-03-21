/**
 * Converts PillarChatMessage[] to simple { role, content } messages
 * for replaying conversations through OpenAI / Anthropic APIs.
 *
 * Images become OpenAI-style multimodal content parts.
 * Sources and progress events are omitted.
 */

import type { PillarChatMessage } from '../hooks/usePillarChat';
import type { PillarSimpleMessage, SimpleContentPart } from './types';

export function toSimpleMessages(
  messages: PillarChatMessage[],
): PillarSimpleMessage[] {
  return messages.map((msg) => {
    if (!msg.images?.length) {
      return { role: msg.role, content: msg.content };
    }

    const parts: SimpleContentPart[] = [
      { type: 'text', text: msg.content },
    ];

    for (const img of msg.images) {
      parts.push({
        type: 'image_url',
        image_url: { url: img.url, detail: img.detail },
      });
    }

    return { role: msg.role, content: parts };
  });
}
