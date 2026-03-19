/**
 * usePillarTools Hook
 *
 * Register multiple tools with optional result card components.
 * Tools are registered on mount and unregistered on unmount.
 *
 * @example Basic tools without cards
 * ```tsx
 * import { usePillarTools, defineTool } from '@pillar-ai/react';
 *
 * function ShoeStore() {
 *   usePillarTools([
 *     defineTool({
 *       name: 'search_shoes',
 *       description: 'Search for shoes by query',
 *       inputSchema: {
 *         type: 'object',
 *         properties: {
 *           query: { type: 'string' },
 *         },
 *         required: ['query'],
 *       },
 *       execute: async ({ query }) => searchShoes(query),
 *     }),
 *   ]);
 *
 *   return <div>Shoe Store</div>;
 * }
 * ```
 *
 * @example Tools with result card components
 * ```tsx
 * import { usePillarTools, defineTool, type ToolResultCardProps } from '@pillar-ai/react';
 *
 * // Define the result card component
 * function ShoeSearchResults({ data }: ToolResultCardProps<{ shoes: Shoe[] }>) {
 *   return (
 *     <div className="grid grid-cols-2 gap-2">
 *       {data.shoes.map(shoe => (
 *         <div key={shoe.id}>{shoe.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 *
 * function ShoeStore() {
 *   usePillarTools([
 *     {
 *       tool: defineTool({
 *         name: 'search_shoes',
 *         description: 'Search for shoes',
 *         inputSchema: { ... },
 *         execute: async ({ query }) => ({ shoes: await searchShoes(query) }),
 *       }),
 *       ResultCard: ShoeSearchResults,
 *     },
 *   ]);
 *
 *   return <div>Shoe Store</div>;
 * }
 * ```
 */

import type { ToolSchema, CardCallbacks } from "@pillar-ai/sdk";
import React, { useEffect, useMemo, useRef, type ComponentType } from "react";
import { usePillarContext, usePortalRegistry } from "../PillarProvider";

/**
 * Props passed to tool result card components.
 */
export interface ToolResultCardProps<T = Record<string, unknown>> {
  /** The data returned by the tool's execute function */
  data: T;
  /** Call to dismiss the card */
  onDismiss?: () => void;
}

/**
 * A tool definition with an optional result card component.
 */
export interface ToolWithCard<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> {
  /** The tool schema */
  tool: ToolSchema<TInput>;
  /** Optional React component to render the tool's result */
  ResultCard?: ComponentType<ToolResultCardProps<TOutput>>;
}

/**
 * Input type for usePillarTools - can be a plain tool schema or a tool with card.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolDefinition = ToolSchema<any> | ToolWithCard<any, any>;

/**
 * Type guard to check if a definition is a ToolWithCard
 */
function isToolWithCard(def: ToolDefinition): def is ToolWithCard {
  return 'tool' in def && def.tool !== undefined;
}

/**
 * Extract the tool schema from a ToolDefinition
 */
function getToolSchema(def: ToolDefinition): ToolSchema {
  if (isToolWithCard(def)) {
    return def.tool;
  }
  return def as ToolSchema;
}

/**
 * Register multiple Pillar tools with optional result card components.
 *
 * Tools are registered when the component mounts and automatically
 * unregistered when it unmounts. The `execute` functions always capture
 * the latest React state and props via refs.
 *
 * @param definitions - Array of tool definitions (plain schemas or tools with cards)
 */
export function usePillarTools(definitions: ToolDefinition[]): void {
  const { pillar } = usePillarContext();
  const registerPortal = usePortalRegistry();

  // Keep refs to latest definitions so handlers capture current state/props
  const definitionsRef = useRef(definitions);
  definitionsRef.current = definitions;

  // Stable dependency key for the effect (tool names joined)
  const toolNamesKey = useMemo(
    () => definitions.map(def => getToolSchema(def).name).join(","),
    [definitions]
  );

  // Keep a stable ref to registerPortal so effect doesn't re-run when it changes
  const registerPortalRef = useRef(registerPortal);
  registerPortalRef.current = registerPortal;

  useEffect(() => {
    if (!pillar) return;

    const unsubscribes: Array<() => void> = [];
    const portalCleanups: Array<() => void> = [];
    let idCounter = 0;

    definitionsRef.current.forEach((def, index) => {
      const schema = getToolSchema(def);

      // Register the tool
      const unsubTool = pillar.defineTool({
        ...schema,
        // Wrap execute to always use the latest ref version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execute: (input: any) => {
          const currentDef = definitionsRef.current[index];
          const currentSchema = getToolSchema(currentDef);
          if (currentSchema.execute) {
            return currentSchema.execute(input);
          }
        },
      } as ToolSchema);

      unsubscribes.push(unsubTool);

      // If there's a ResultCard, register it as a card renderer
      if (isToolWithCard(def) && def.ResultCard) {
        const ResultCard = def.ResultCard;
        const cardType = `tool_result_${schema.name}`;

        const unsubCard = pillar.registerCard(
          cardType,
          (container, data, callbacks: CardCallbacks) => {
            const portalId = `tool-result-${schema.name}-${idCounter++}`;
            const cleanup = registerPortalRef.current(
              portalId,
              container,
              <ResultCard
                data={data}
                onDismiss={callbacks.onStateChange ? () => callbacks.onStateChange!('success') : undefined}
              />
            );
            portalCleanups.push(cleanup);
            return cleanup;
          }
        );

        unsubscribes.push(unsubCard);
      }
    });

    // Cleanup: unregister all tools, cards, and portals
    return () => {
      unsubscribes.forEach(unsub => unsub());
      portalCleanups.forEach(cleanup => cleanup());
    };
  }, [pillar, toolNamesKey]);
}
