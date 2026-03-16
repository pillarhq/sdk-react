/**
 * usePillarTool Hook
 *
 * Register one or more tools with co-located metadata and handlers.
 * Tools are registered on mount and unregistered on unmount.
 *
 * @example Single tool
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
 * @example Tool with inline render
 * ```tsx
 * import { usePillarTool } from '@pillar-ai/react';
 *
 * function ShoeStore() {
 *   usePillarTool({
 *     name: 'search_shoes',
 *     description: 'Search for shoes',
 *     type: 'inline_ui',
 *     execute: async ({ query }) => ({ shoes: await searchShoes(query) }),
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

import type { ToolSchema, CardCallbacks } from "@pillar-ai/sdk";
import React, { useEffect, useMemo, useRef, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePillarContext } from "../PillarProvider";

/**
 * Props passed to tool render components.
 */
export interface ToolRenderProps<T = Record<string, unknown>> {
  /** Data returned by the tool's execute function */
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
 * Extended tool schema that accepts a React component for render.
 * The component receives ToolRenderProps and renders the card UI.
 */
export interface ReactToolSchema<TInput = Record<string, unknown>>
  extends Omit<ToolSchema<TInput>, "render"> {
  /**
   * React component to render the tool's result inline in chat.
   *
   * When provided, the SDK automatically registers this as a card renderer
   * using the tool name as the card type. The card is rendered when the
   * tool's execute function returns data.
   *
   * @example
   * ```tsx
   * render: ({ data, onConfirm }) => (
   *   <div onClick={onConfirm}>{data.result}</div>
   * )
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: ComponentType<ToolRenderProps<any>>;
}

/**
 * Register one or more Pillar tools with co-located metadata and handlers.
 *
 * The tools are registered when the component mounts and automatically
 * unregistered when it unmounts. The `execute` functions always capture
 * the latest React state and props via refs, so you don't need to worry
 * about stale closures.
 *
 * If a tool has a `render` prop, the SDK automatically registers it as
 * a card renderer using the tool name as the card type.
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
      // Register the tool
      const unsubTool = pillar.defineTool({
        ...schema,
        // Wrap execute to always use the latest ref version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execute: (input: any) => schemasRef.current[index].execute(input),
      } as ToolSchema);

      unsubscribes.push(unsubTool);

      // If there's a render component, register it as a card renderer
      if (schema.render) {
        const RenderComponent = schema.render;
        const cardType = schema.name;

        const unsubCard = pillar.registerCard(
          cardType,
          (container, data, callbacks: CardCallbacks) => {
            const root = createRoot(container);
            cardRoots.set(container, root);

            root.render(
              React.createElement(RenderComponent, {
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
