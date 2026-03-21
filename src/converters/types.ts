/**
 * Structurally-compatible output types for message converters.
 *
 * These types mirror the shapes of AI SDK UIMessage, AG-UI Message, and
 * OpenAI-style CoreMessage WITHOUT importing from those packages.
 * TypeScript structural typing means these are directly assignable:
 *
 *   const msgs: UIMessage[] = toUIMessages(pillarMessages); // works
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface ConverterOptions {
  /** Base URL for help-center article links (e.g. "https://help.myapp.com"). */
  helpCenterUrl?: string;
}

// ---------------------------------------------------------------------------
// AI SDK UIMessage — structurally compatible
// ---------------------------------------------------------------------------

export type PillarUIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'file'; url: string; mediaType: string }
  | { type: 'source-url'; sourceId: string; url: string; title?: string }
  | { type: 'step-start' }
  | { type: 'reasoning'; text: string };

export interface PillarUIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: PillarUIMessagePart[];
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// AG-UI Message — structurally compatible
// ---------------------------------------------------------------------------

export interface AGUITextInput {
  type: 'text';
  text: string;
}

export interface AGUIBinaryInput {
  type: 'binary';
  mimeType: string;
  url?: string;
  data?: string;
}

export type AGUIInputContent = AGUITextInput | AGUIBinaryInput;

export interface AGUIUserMessage {
  id: string;
  role: 'user';
  content: string | AGUIInputContent[];
}

export interface AGUIAssistantMessage {
  id: string;
  role: 'assistant';
  content?: string;
}

export interface AGUIActivityMessage {
  id: string;
  role: 'activity';
  activityType: string;
  content: Record<string, unknown>;
}

export interface AGUIReasoningMessage {
  id: string;
  role: 'reasoning';
  content: string;
}

export type PillarAGUIMessage =
  | AGUIUserMessage
  | AGUIAssistantMessage
  | AGUIActivityMessage
  | AGUIReasoningMessage;

// ---------------------------------------------------------------------------
// Simple CoreMessage — for OpenAI/Anthropic API replay
// ---------------------------------------------------------------------------

export type SimpleContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

export interface PillarSimpleMessage {
  role: 'user' | 'assistant';
  content: string | SimpleContentPart[];
}
