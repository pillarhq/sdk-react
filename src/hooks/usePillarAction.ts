/**
 * usePillarAction Hook
 *
 * Register one or more actions with co-located metadata and handlers.
 * Actions are registered on mount and unregistered on unmount.
 *
 * @example Single action
 * ```tsx
 * import { usePillarAction } from '@pillar-ai/react';
 *
 * function CartButton() {
 *   usePillarAction({
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
 * @example Multiple actions
 * ```tsx
 * import { usePillarAction } from '@pillar-ai/react';
 *
 * function BillingPage() {
 *   usePillarAction([
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

import { useEffect, useRef, useMemo } from 'react';
import type { ActionSchema } from '@pillar-ai/sdk';
import { usePillarContext } from '../PillarProvider';

/**
 * Register a single Pillar action with co-located metadata and handler.
 */
export function usePillarAction<TInput = Record<string, unknown>>(
  schema: ActionSchema<TInput>
): void;

/**
 * Register multiple Pillar actions with co-located metadata and handlers.
 */
export function usePillarAction(schemas: ActionSchema[]): void;

/**
 * Register one or more Pillar actions with co-located metadata and handlers.
 *
 * The actions are registered when the component mounts and automatically
 * unregistered when it unmounts. The `execute` functions always capture
 * the latest React state and props via refs, so you don't need to worry
 * about stale closures.
 *
 * @param schemaOrSchemas - Single action schema or array of action schemas
 */
export function usePillarAction<TInput = Record<string, unknown>>(
  schemaOrSchemas: ActionSchema<TInput> | ActionSchema[]
): void {
  const { pillar } = usePillarContext();

  // Normalize to array for consistent handling
  const schemas = useMemo(
    () => (Array.isArray(schemaOrSchemas) ? schemaOrSchemas : [schemaOrSchemas]),
    [schemaOrSchemas]
  );

  // Keep refs to latest schemas so handlers capture current state/props
  const schemasRef = useRef(schemas);
  schemasRef.current = schemas;

  // Stable dependency key for the effect (action names joined)
  const actionNamesKey = useMemo(
    () => schemas.map((s) => s.name).join(','),
    [schemas]
  );

  useEffect(() => {
    if (!pillar) return;

    // Register all actions and collect unsubscribe functions
    const unsubscribes = schemasRef.current.map((schema, index) => {
      return pillar.defineAction({
        ...schema,
        // Wrap execute to always use the latest ref version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execute: (input: any) => schemasRef.current[index].execute(input),
      } as ActionSchema);
    });

    // Cleanup: unregister all actions
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [pillar, actionNamesKey]);
}
