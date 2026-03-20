/**
 * usePillarTool Hook
 *
 * Register one or more tools with co-located metadata and handlers.
 * Tools are registered on mount and unregistered on unmount.
 *
 * - For `type: 'inline_ui'` tools: provide `render` (a React component).
 *   The AI agent supplies data directly to the component — no `execute` needed.
 * - For all other tool types: provide `execute`. No `render` prop.
 *
 * @example Single executable tool
 * ```tsx
 * import { usePillarTool } from '@pillar-ai/react';
 *
 * function CartButton() {
 *   usePillarTool({
 *     name: 'add_to_cart',
 *     description: 'Add a product to the shopping cart',
 *     inputSchema: {
 *       type: 'object',
 *       properties: {
 *         productId: { type: 'string', description: 'Product ID' },
 *         quantity: { type: 'number', description: 'Quantity to add' },
 *       },
 *       required: ['productId', 'quantity'],
 *     },
 *     execute: async ({ productId, quantity }) => {
 *       await cartApi.add(productId, quantity);
 *       return { content: [{ type: 'text', text: 'Added to cart' }] };
 *     },
 *   });
 *
 *   return <button>Cart</button>;
 * }
 * ```
 *
 * @example Inline UI tool with render component
 * ```tsx
 * import { usePillarTool } from '@pillar-ai/react';
 *
 * function ShoeStore() {
 *   usePillarTool({
 *     name: 'search_shoes',
 *     description: 'Search for shoes',
 *     type: 'inline_ui',
 *     render: ({ data }) => (
 *       <div className="grid grid-cols-2 gap-2">
 *         {data.shoes.map(shoe => (
 *           <div key={shoe.id}>{shoe.name}</div>
 *         ))}
 *       </div>
 *     ),
 *   });
 *
 *   return <div>Shoe Store</div>;
 * }
 * ```
 *
 * @example Executable tool with confirmation step
 * ```tsx
 * import { usePillarTool } from '@pillar-ai/react';
 *
 * function DangerZone() {
 *   usePillarTool({
 *     name: 'delete_account',
 *     description: 'Permanently delete the user account',
 *     needsConfirmation: true,
 *     execute: async () => {
 *       await api.deleteAccount();
 *       return { success: true };
 *     },
 *   });
 *
 *   return <div>Settings</div>;
 * }
 * ```
 *
 * @example Executable tool with custom confirmation UI
 * ```tsx
 * import { usePillarTool, type ConfirmationRenderProps } from '@pillar-ai/react';
 *
 * function ConfirmDelete({ data, onConfirm, onCancel }: ConfirmationRenderProps) {
 *   return (
 *     <div>
 *       <p>Are you sure you want to delete {data.name}?</p>
 *       <button onClick={() => onConfirm()}>Yes, delete</button>
 *       <button onClick={onCancel}>Cancel</button>
 *     </div>
 *   );
 * }
 *
 * function DangerZone() {
 *   usePillarTool({
 *     name: 'delete_account',
 *     description: 'Permanently delete the user account',
 *     renderConfirmation: ConfirmDelete,
 *     execute: async () => {
 *       await api.deleteAccount();
 *       return { success: true };
 *     },
 *   });
 *
 *   return <div>Settings</div>;
 * }
 * ```
 *
 * @example Multiple tools
 * ```tsx
 * import { usePillarTool } from '@pillar-ai/react';
 *
 * function BillingPage() {
 *   usePillarTool([
 *     {
 *       name: 'get_current_plan',
 *       description: 'Get the current billing plan',
 *       execute: async () => ({ plan: 'pro', price: 29 }),
 *     },
 *     {
 *       name: 'upgrade_plan',
 *       description: 'Upgrade to a higher plan',
 *       inputSchema: {
 *         type: 'object',
 *         properties: { planId: { type: 'string' } },
 *         required: ['planId'],
 *       },
 *       execute: async ({ planId }) => {
 *         await billingApi.upgrade(planId);
 *         return { content: [{ type: 'text', text: 'Upgraded!' }] };
 *       },
 *     },
 *   ]);
 *
 *   return <div>Billing Content</div>;
 * }
 * ```
 */

import type {
  ToolSchema,
  InlineUIToolSchema,
  ExecutableToolSchema,
  CardCallbacks,
  ToolCardContext,
} from "@pillar-ai/sdk";
import React, { useEffect, useMemo, useRef, useSyncExternalStore, type ComponentType } from "react";
import { usePillarContext, usePortalRegistry } from "../PillarProvider";

/**
 * Props passed to tool render components.
 */
export interface ToolRenderProps<T = Record<string, unknown>> {
  /** Data provided by the AI agent */
  data: T;
  /**
   * Send a result back to the AI agent, continuing the conversation.
   * The agent sees this as the tool's response and can reason about it
   * (e.g., invoke another tool like a checkout flow).
   *
   * @example
   * ```tsx
   * function ShoeResults({ data, sendResult }: ToolRenderProps<ShoeSearchOutput>) {
   *   const handleAddToCart = (shoes: Shoe[]) => {
   *     cartStore.add(shoes);
   *     sendResult({ addedToCart: shoes.map(s => s.name), cartTotal: 289 });
   *   };
   * }
   * ```
   */
  sendResult: (result: Record<string, unknown>) => Promise<void>;
  /** Context about this card's position in the chat. */
  context: ToolCardContext;
  /** Report state changes (loading, success, error) */
  onStateChange?: (
    state: "loading" | "success" | "error",
    message?: string
  ) => void;
}

/**
 * Props passed to custom confirmation render components.
 * Only used with executable (non-inline_ui) tools that have `renderConfirmation`.
 */
export interface ConfirmationRenderProps<T = Record<string, unknown>> {
  /** Data the AI provided when invoking the tool */
  data: T;
  /** Call to approve the action — triggers the tool's `execute` handler and sends the result to the AI */
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  /** Call to dismiss the confirmation — no execution, card collapses */
  onCancel: () => void;
}

/**
 * React inline_ui tool schema. Requires `render`, forbids `execute`.
 *
 * The AI agent provides data directly to the React component.
 */
export interface ReactInlineUIToolSchema<TInput = Record<string, unknown>>
  extends Omit<InlineUIToolSchema<TInput>, "render"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: ComponentType<ToolRenderProps<any>>;
}

/**
 * React executable tool schema. Requires `execute`, forbids `render`.
 *
 * Optionally supports `needsConfirmation` and `renderConfirmation` to gate
 * execution behind user approval.
 */
export interface ReactExecutableToolSchema<TInput = Record<string, unknown>>
  extends ExecutableToolSchema<TInput> {
  /**
   * When true, the SDK shows a confirmation UI before calling `execute`.
   * Uses default Confirm / Cancel buttons unless `renderConfirmation` is provided.
   */
  needsConfirmation?: boolean;
  /**
   * Custom React component for the confirmation step.
   * Receives `{ data, onConfirm, onCancel }`. Implies `needsConfirmation`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderConfirmation?: ComponentType<ConfirmationRenderProps<any>>;
}

/**
 * Tool schema for `usePillarTool`. Discriminated on `type`:
 *
 * - `type: 'inline_ui'` → `render` required, `execute` forbidden
 * - all other types → `execute` required, `render` forbidden
 */
export type ReactToolSchema<TInput = Record<string, unknown>> =
  | ReactInlineUIToolSchema<TInput>
  | ReactExecutableToolSchema<TInput>;

/**
 * Fallback UI displayed when an inline_ui tool's render component throws an error.
 * Shows a generic user-facing message (technical details are sent to the LLM).
 */
function ErrorFallbackUI() {
  return React.createElement(
    "div",
    {
      style: {
        padding: "12px 16px",
        borderRadius: "8px",
        backgroundColor: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        fontSize: "14px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
    },
    React.createElement(
      "div",
      { style: { fontWeight: 500 } },
      "Something went wrong displaying this content"
    )
  );
}

/**
 * Error boundary that catches render errors from inline_ui tool components.
 * Displays a fallback UI and notifies the LLM about the error.
 */
interface InlineUIErrorBoundaryProps {
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pillar: any;
  children?: React.ReactNode;
}

class InlineUIErrorBoundary extends React.Component<
  InlineUIErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: InlineUIErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.pillar.sendToolResultAsMessage(this.props.toolName, {
      success: false,
      error: `Component render error: ${error.message}`,
      errorType: "render_error",
    });
  }

  render() {
    if (this.state.hasError) {
      return React.createElement(ErrorFallbackUI);
    }
    return this.props.children;
  }
}

/**
 * Wrapper component that reactively computes ToolCardContext.
 * Re-renders when the message list changes so `isLatest` stays accurate.
 */
function ReactiveCardWrapper({
  RenderComponent,
  data,
  sendResult,
  onStateChange,
  messageIndex,
  segmentIndex,
  toolName,
  pillar,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RenderComponent: ComponentType<ToolRenderProps<any>>;
  data: Record<string, unknown>;
  sendResult: (result: Record<string, unknown>) => Promise<void>;
  onStateChange?: (state: "loading" | "success" | "error", message?: string) => void;
  messageIndex: number;
  segmentIndex: number;
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pillar: any;
}) {
  const subscribe = React.useCallback(
    (cb: () => void) => pillar.subscribeToMessages(cb),
    [pillar]
  );
  const getSnapshot = React.useCallback(() => {
    // Return a serialized snapshot of "is this position latest"
    // useSyncExternalStore needs a stable value to compare
    return pillar.isPositionLatest(messageIndex, segmentIndex) ? "true" : "false";
  }, [pillar, messageIndex, segmentIndex]);

  const isLatestStr = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isLatest = isLatestStr === "true";

  const subscribeLoading = React.useCallback(
    (cb: () => void) => pillar.subscribeToLoadingState(cb),
    [pillar]
  );
  const getLoadingSnapshot = React.useCallback(
    () => (pillar.isChatLoading ? "loading" : "ready"),
    [pillar]
  );
  const readyStr = useSyncExternalStore(subscribeLoading, getLoadingSnapshot, getLoadingSnapshot);
  const isReady = readyStr === "ready";

  const context: ToolCardContext = {
    isLatest,
    isReady,
    messageIndex,
    segmentIndex,
    toolName,
  };

  return React.createElement(RenderComponent, {
    data,
    sendResult,
    context,
    onStateChange,
  });
}

/**
 * Register one or more Pillar tools with co-located metadata and handlers.
 *
 * The tools are registered when the component mounts and automatically
 * unregistered when it unmounts. The `execute` functions always capture
 * the latest React state and props via refs, so you don't need to worry
 * about stale closures.
 *
 * - `inline_ui` tools register a card renderer from the `render` prop.
 * - All other tools register the `execute` handler.
 *
 * @param schemaOrSchemas - Single tool schema or array of tool schemas
 */
export function usePillarTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaOrSchemas: ReactToolSchema<any> | ReactToolSchema<any>[]
): void {
  const { pillar } = usePillarContext();
  const registerPortal = usePortalRegistry();

  // Normalize to array for consistent handling
  const schemas = useMemo(
    () =>
      Array.isArray(schemaOrSchemas) ? schemaOrSchemas : [schemaOrSchemas],
    [schemaOrSchemas]
  );

  // Keep refs to latest schemas so handlers capture current state/props
  const schemasRef = useRef(schemas);
  schemasRef.current = schemas;

  // Stable dependency key for the effect (tool names joined)
  const toolNamesKey = useMemo(
    () => schemas.map((s) => s.name).join(","),
    [schemas]
  );

  // Keep a stable ref to registerPortal so effect doesn't re-run when it changes
  const registerPortalRef = useRef(registerPortal);
  registerPortalRef.current = registerPortal;

  useEffect(() => {
    if (!pillar) return;

    const unsubscribes: Array<() => void> = [];
    const portalCleanups: Array<() => void> = [];
    let idCounter = 0;

    schemasRef.current.forEach((schema, index) => {
      if (schema.type === "inline_ui") {
        // inline_ui: register card renderer, no execute
        const RenderComponent = schema.render;
        const cardType = schema.name;

        // Register the tool definition (without execute) so the SDK knows about it
        const { render: _render, ...sdkSchema } = schema;
        const unsubTool = pillar.defineTool(sdkSchema as ToolSchema);
        unsubscribes.push(unsubTool);

        const unsubCard = pillar.registerCard(
          cardType,
          (container, data, callbacks: CardCallbacks, context) => {
            const CurrentRender =
              schemasRef.current[index].type === "inline_ui"
                ? (
                    schemasRef.current[index] as ReactInlineUIToolSchema<
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      any
                    >
                  ).render
                : RenderComponent;

            const portalId = `tool-${cardType}-${idCounter++}`;
            const cleanup = registerPortalRef.current(
              portalId,
              container,
              React.createElement(
                InlineUIErrorBoundary,
                { toolName: cardType, pillar },
                React.createElement(ReactiveCardWrapper, {
                  RenderComponent: CurrentRender,
                  data,
                  sendResult: (result: Record<string, unknown>) => {
                    pillar.sendToolResultAsMessage(cardType, result);
                    return Promise.resolve();
                  },
                  onStateChange: callbacks.onStateChange,
                  messageIndex: context?.messageIndex ?? -1,
                  segmentIndex: context?.segmentIndex ?? -1,
                  toolName: cardType,
                  pillar,
                })
              )
            );
            portalCleanups.push(cleanup);

            return cleanup;
          }
        );

        unsubscribes.push(unsubCard);
      } else {
        const execSchema = schema as ReactExecutableToolSchema<
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >;
        const wantsConfirmation =
          execSchema.needsConfirmation || !!execSchema.renderConfirmation;

        if (wantsConfirmation) {
          // Register the tool WITHOUT execute so the SDK doesn't auto-run it.
          // We store execute locally and call it from the confirmation card.
          const {
            execute: _execute,
            needsConfirmation: _nc,
            renderConfirmation: _rc,
            ...sdkSchema
          } = execSchema;

          // Mark as needsConfirmation so the core SDK knows to show a card
          const unsubTool = pillar.defineTool({
            ...sdkSchema,
            needsConfirmation: true,
          } as unknown as ToolSchema);
          unsubscribes.push(unsubTool);

          const ConfirmComponent = execSchema.renderConfirmation;

          const unsubCard = pillar.registerCard(
            schema.name,
            (container, data, callbacks: CardCallbacks) => {
              const handleConfirm = async (
                modifiedData?: Record<string, unknown>
              ) => {
                const currentSchema = schemasRef.current[
                  index
                ] as ReactExecutableToolSchema<
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  any
                >;
                const executeData = modifiedData || data;

                try {
                  callbacks.onStateChange?.("loading");
                  const result = await currentSchema.execute(executeData);
                  if (result !== undefined) {
                    await pillar.sendToolResult(schema.name, result);
                  }
                  callbacks.onStateChange?.("success");
                } catch (err) {
                  callbacks.onStateChange?.(
                    "error",
                    err instanceof Error ? err.message : String(err)
                  );
                  await pillar.sendToolResult(schema.name, {
                    success: false,
                    error:
                      err instanceof Error ? err.message : String(err),
                  });
                }
              };

              const handleCancel = () => {
                callbacks.onCancel?.();
              };

              if (ConfirmComponent) {
                const CurrentConfirm =
                  (
                    schemasRef.current[
                      index
                    ] as ReactExecutableToolSchema<
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      any
                    >
                  ).renderConfirmation || ConfirmComponent;

                const portalId = `confirm-${schema.name}-${idCounter++}`;
                const cleanup = registerPortalRef.current(
                  portalId,
                  container,
                  React.createElement(CurrentConfirm, {
                    data,
                    onConfirm: handleConfirm,
                    onCancel: handleCancel,
                  })
                );
                portalCleanups.push(cleanup);

                return cleanup;
              } else {
                // Use the default card — wire confirm/cancel through callbacks
                callbacks.onConfirm = handleConfirm;
                callbacks.onCancel = handleCancel;
              }
            }
          );

          unsubscribes.push(unsubCard);
        } else {
          // Executable tool without confirmation: register execute handler directly
          const unsubTool = pillar.defineTool({
            ...schema,
            // Wrap execute to always use the latest ref version
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            execute: (input: any) =>
              (
                schemasRef.current[index] as ReactExecutableToolSchema<
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  any
                >
              ).execute(input),
          } as ToolSchema);

          unsubscribes.push(unsubTool);
        }
      }
    });

    // Cleanup: unregister all tools, cards, and portals
    return () => {
      unsubscribes.forEach((unsub) => unsub());
      portalCleanups.forEach((cleanup) => cleanup());
    };
  }, [pillar, toolNamesKey]);
}

/** @deprecated Use usePillarTool instead */
export const usePillarAction = usePillarTool;
