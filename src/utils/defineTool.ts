/**
 * defineTool - Type-safe tool definition helper
 *
 * A simple identity function that provides type inference for tool schemas.
 * Use this when defining tools outside of components to get proper TypeScript support.
 *
 * @example
 * ```ts
 * import { defineTool } from '@pillar-ai/react';
 *
 * export const searchTool = defineTool({
 *   name: 'search_products',
 *   description: 'Search for products by query',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' },
 *     },
 *     required: ['query'],
 *   },
 *   execute: async ({ query }) => {
 *     const results = await searchProducts(query);
 *     return { products: results };
 *   },
 * });
 * ```
 */

import type { ToolSchema } from "@pillar-ai/sdk";

/**
 * Identity function for defining tools with full type inference.
 * Returns the schema unchanged - exists purely for TypeScript support.
 */
export function defineTool<TInput = Record<string, unknown>>(
  schema: ToolSchema<TInput>
): ToolSchema<TInput> {
  return schema;
}
