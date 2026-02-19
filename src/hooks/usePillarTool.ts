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

import type { ToolSchema } from "@pillar-ai/sdk";
import { useEffect, useMemo, useRef } from "react";
import { usePillarContext } from "../PillarProvider";

/**
 * Register one or more Pillar tools with co-located metadata and handlers.
 *
 * The tools are registered when the component mounts and automatically
 * unregistered when it unmounts. The `execute` functions always capture
 * the latest React state and props via refs, so you don't need to worry
 * about stale closures.
 *
 * @param schemaOrSchemas - Single tool schema or array of tool schemas
 */
export function usePillarTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaOrSchemas: ToolSchema<any> | ToolSchema<any>[]
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

    // Register all tools and collect unsubscribe functions
    const unsubscribes = schemasRef.current.map((schema, index) => {
      return pillar.defineTool({
        ...schema,
        // Wrap execute to always use the latest ref version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execute: (input: any) => schemasRef.current[index].execute(input),
      } as ToolSchema);
    });

    // Cleanup: unregister all tools
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [pillar, toolNamesKey]);
}

/** @deprecated Use usePillarTool instead */
export const usePillarAction = usePillarTool;
