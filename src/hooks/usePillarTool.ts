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
 *     render: ({ data, onConfirm }) => (
 *       <div className="grid grid-cols-2 gap-2">
 *         {data.shoes.map(shoe => (
 *           <div key={shoe.id} onClick={onConfirm}>{shoe.name}</div>
 *         ))}
 *       </div>
 *     ),
 *   });
 *
 *   return <div>Shoe Store</div>;
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
} from "@pillar-ai/sdk";
import React, { useEffect, useMemo, useRef, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePillarContext } from "../PillarProvider";

/**
 * Props passed to tool render components.
 */
export interface ToolRenderProps<T = Record<string, unknown>> {
  /** Data provided by the AI agent */
  data: T;
  /** Call when user confirms/completes the action */
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  /** Call when user cancels the action */
  onCancel: () => void;
  /** Report state changes (loading, success, error) */
  onStateChange?: (
    state: "loading" | "success" | "error",
    message?: string
  ) => void;
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
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReactExecutableToolSchema<TInput = Record<string, unknown>>
  extends ExecutableToolSchema<TInput> {}

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

  useEffect(() => {
    if (!pillar) return;

    const unsubscribes: Array<() => void> = [];
    const cardRoots: Map<HTMLElement, Root> = new Map();

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
          (container, data, callbacks: CardCallbacks) => {
            const root = createRoot(container);
            cardRoots.set(container, root);

            const CurrentRender =
              schemasRef.current[index].type === "inline_ui"
                ? (
                    schemasRef.current[index] as ReactInlineUIToolSchema<
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      any
                    >
                  ).render
                : RenderComponent;

            root.render(
              React.createElement(CurrentRender, {
                data,
                onConfirm: callbacks.onConfirm,
                onCancel: callbacks.onCancel,
                onStateChange: callbacks.onStateChange,
              })
            );

            return () => {
              const existingRoot = cardRoots.get(container);
              if (existingRoot) {
                existingRoot.unmount();
                cardRoots.delete(container);
              }
            };
          }
        );

        unsubscribes.push(unsubCard);
      } else {
        // Executable tool: register execute handler, no render
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
    });

    // Cleanup: unregister all tools and cards
    return () => {
      unsubscribes.forEach((unsub) => unsub());
      cardRoots.forEach((root) => root.unmount());
      cardRoots.clear();
    };
  }, [pillar, toolNamesKey]);
}

/** @deprecated Use usePillarTool instead */
export const usePillarAction = usePillarTool;
