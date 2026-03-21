// AI SDK (Vercel) converter
export { toUIMessages, usePillarChatUIMessages, type UsePillarChatUIMessagesReturn } from './ai-sdk';

// AG-UI protocol converter
export { toAGUIMessages, usePillarChatAGUI, type UsePillarChatAGUIReturn } from './ag-ui';

// Simple { role, content } converter for API replay
export { toSimpleMessages } from './simple';

// Output types
export type {
  ConverterOptions,
  PillarUIMessage,
  PillarUIMessagePart,
  PillarAGUIMessage,
  AGUIUserMessage,
  AGUIAssistantMessage,
  AGUIActivityMessage,
  AGUIReasoningMessage,
  AGUIInputContent,
  AGUITextInput,
  AGUIBinaryInput,
  PillarSimpleMessage,
  SimpleContentPart,
} from './types';
