/**
 * PillarProvider
 * Context provider that initializes and manages the Pillar SDK
 */

import {
  Pillar,
  scanPageDirect,
  type CardCallbacks,
  type CompactScanResult,
  type PillarConfig,
  type PillarEvents,
  type PillarState,
  type ScanOptions,
  type TaskExecutePayload,
  type ThemeConfig,
} from "@pillar-ai/sdk";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// ============================================================================
// Card Types
// ============================================================================

/**
 * Props passed to custom card components.
 */
export interface CardComponentProps<T = Record<string, unknown>> {
  /** Data extracted by the AI for this action */
  data: T;
  /** Called to report state changes (loading, success, error) */
  onStateChange?: (
    state: "loading" | "success" | "error",
    message?: string
  ) => void;
}

/**
 * A React component that can be used as a custom card renderer.
 */
export type CardComponent<T = Record<string, unknown>> = ComponentType<
  CardComponentProps<T>
>;

// ============================================================================
// Types
// ============================================================================

export interface PillarContextValue {
  /** The Pillar SDK instance */
  pillar: Pillar | null;

  /** Current SDK state */
  state: PillarState;

  /** Whether the SDK is ready */
  isReady: boolean;

  /** Whether the panel is currently open */
  isPanelOpen: boolean;

  /** Open the help panel */
  open: (options?: {
    view?: string;
    article?: string;
    search?: string;
    focusInput?: boolean;
  }) => void;

  /** Close the help panel */
  close: () => void;

  /** Toggle the help panel */
  toggle: () => void;

  /** Open a specific article */
  openArticle: (slug: string) => void;

  /** Open a specific category */
  openCategory: (slug: string) => Promise<void>;

  /** Perform a search */
  search: (query: string) => void;

  /** Navigate to a specific view */
  navigate: (view: string, params?: Record<string, string>) => void;

  /** Update the panel theme at runtime */
  setTheme: (theme: Partial<ThemeConfig>) => void;

  /** Enable or disable the text selection "Ask AI" popover */
  setTextSelectionEnabled: (enabled: boolean) => void;

  /**
   * Enable or disable DOM scanning.
   * @deprecated DOM scanning is currently disabled and this method has no effect.
   */
  setDOMScanningEnabled: (enabled: boolean) => void;

  /**
   * Whether DOM scanning is enabled.
   * @deprecated Always returns false - DOM scanning is disabled.
   */
  isDOMScanningEnabled: boolean;

  /** Manually scan the page and get the compact result */
  scanPage: (options?: ScanOptions) => CompactScanResult | null;

  /** Subscribe to SDK events */
  on: <K extends keyof PillarEvents>(
    event: K,
    callback: (data: PillarEvents[K]) => void
  ) => () => void;
}

export interface PillarProviderProps {
  /**
   * Your product key from the Pillar app.
   * Get it at app.trypillar.com
   */
  productKey?: string;

  /**
   * @deprecated Use `productKey` instead. Will be removed in v1.0.
   */
  helpCenter?: string;

  /**
   * Additional SDK configuration
   *
   * Notable options:
   * - `panel.useShadowDOM`: Whether to isolate styles in Shadow DOM (default: false).
   *   Set to false to let custom cards inherit your app's CSS (Tailwind, etc.)
   */
  config?: Omit<PillarConfig, "productKey" | "helpCenter">;

  /**
   * Handler called when a task action is triggered from the chat.
   * Use this to handle AI-suggested actions like opening modals, navigating, etc.
   *
   * @example
   * ```tsx
   * <PillarProvider
   *   productKey="my-product-key"
   *   onTask={(task) => {
   *     switch (task.name) {
   *       case 'invite_team_member':
   *         openInviteModal(task.data);
   *         break;
   *       case 'open_settings':
   *         router.push('/settings');
   *         break;
   *     }
   *   }}
   * >
   * ```
   */
  onTask?: (task: TaskExecutePayload) => void;

  /**
   * Custom card components to render for inline_ui type actions.
   * Map card type names to React components that will render the inline UI.
   *
   * @deprecated Use the `render` prop on `usePillarTool` instead to co-locate
   * the card renderer with the tool definition. This prop will be removed in v2.0.
   *
   * @example New pattern (recommended):
   * ```tsx
   * usePillarTool({
   *   name: 'invite_members',
   *   description: 'Invite team members',
   *   type: 'inline_ui',
   *   render: ({ data }) => <InviteMembersCard data={data} />,
   * });
   * ```
   *
   * @example Legacy pattern (deprecated):
   * ```tsx
   * <PillarProvider
   *   productKey="my-product-key"
   *   cards={{
   *     invite_members: InviteMembersCard,
   *   }}
   * >
   * ```
   */
  cards?: Record<string, CardComponent>;

  /**
   * Enable DOM scanning to send page context with messages.
   * @deprecated DOM scanning is currently disabled. This prop has no effect.
   */
  domScanning?: boolean;

  /**
   * Enable DOM scanning dev mode to preview the scanned page before sending.
   * Shows a modal with the AST tree visualization before each message is sent.
   * Useful for debugging what context will be sent to the LLM.
  /** Children components */
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const PillarContext = createContext<PillarContextValue | null>(null);

// ============================================================================
// Portal Registry (internal — not part of the public API)
// ============================================================================

interface PortalEntry {
  container: HTMLElement;
  element: ReactNode;
}

type RegisterPortalFn = (
  id: string,
  container: HTMLElement,
  element: ReactNode
) => () => void;

const PortalRegistryContext = createContext<RegisterPortalFn | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export function PillarProvider({
  productKey,
  helpCenter,
  config,
  onTask,
  cards,
  domScanning: _domScanning, // Deprecated - DOM scanning is disabled
  children,
}: PillarProviderProps): React.ReactElement {
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [state, setState] = useState<PillarState>("uninitialized");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // DOM scanning is disabled - always false
  const isDOMScanningEnabled = false;

  // Portal registry: card components rendered via createPortal to preserve
  // the host app's React context (Redux, React Query, themes, etc.)
  const [portals, setPortals] = useState<Map<string, PortalEntry>>(
    () => new Map()
  );

  const registerPortal = useCallback<RegisterPortalFn>(
    (id, container, element) => {
      setPortals((prev) => {
        const next = new Map(prev);
        next.set(id, { container, element });
        return next;
      });
      return () => {
        setPortals((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      };
    },
    []
  );

  // Support both productKey (new) and helpCenter (deprecated)
  const resolvedKey = productKey ?? helpCenter;

  // Keep a ref to the latest onTask callback to avoid re-subscribing
  const onTaskRef = useRef(onTask);
  onTaskRef.current = onTask;

  // Warn about deprecated helpCenter usage
  useEffect(() => {
    if (helpCenter && !productKey) {
      console.warn(
        '[Pillar React] "helpCenter" prop is deprecated. Use "productKey" instead.'
      );
    }
  }, []);

  // Keep a ref to cards to access latest versions
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // Initialize SDK
  useEffect(() => {
    let mounted = true;

    const initPillar = async () => {
      try {
        // Pillar is a singleton - check if already initialized
        const existingInstance = Pillar.getInstance();
        if (existingInstance) {
          // Reuse existing instance (preserves chat history, panel state, etc.)
          if (mounted) {
            setPillar(existingInstance);
            setState(existingInstance.state);

            // Re-subscribe to events
            existingInstance.on("panel:open", () => {
              setIsPanelOpen(true);
            });

            existingInstance.on("panel:close", () => {
              setIsPanelOpen(false);
            });
          }
          return;
        }

        // Initialize new instance
        // Note: DOM scanning is disabled, config.domScanning is ignored
        const instance = await Pillar.init({
          productKey: resolvedKey,
          ...config,
        });

        if (mounted) {
          setPillar(instance);
          setState(instance.state);

          // Listen for panel open/close
          instance.on("panel:open", () => {
            setIsPanelOpen(true);
          });

          instance.on("panel:close", () => {
            setIsPanelOpen(false);
          });
        }
      } catch (error) {
        console.error("[Pillar React] Failed to initialize:", error);
        if (mounted) {
          setState("error");
        }
      }
    };

    initPillar();

    // Cleanup - DON'T destroy the singleton on unmount
    // This preserves conversation history and panel state across navigation
    // Pillar.destroy() should only be called explicitly when the app unmounts completely
    return () => {
      mounted = false;
      // Note: We intentionally don't call Pillar.destroy() here
      // The singleton persists to maintain state across route changes
    };
  }, [resolvedKey]); // Re-initialize if productKey changes

  // Update state when SDK state changes
  useEffect(() => {
    if (pillar) {
      const unsubscribe = pillar.on("ready", () => {
        setState("ready");
      });

      const unsubscribeError = pillar.on("error", () => {
        setState("error");
      });

      return () => {
        unsubscribe();
        unsubscribeError();
      };
    }
  }, [pillar]);

  // Register task handler
  useEffect(() => {
    if (pillar) {
      const unsubscribe = pillar.on("task:execute", (task) => {
        onTaskRef.current?.(task);
      });

      return unsubscribe;
    }
  }, [pillar]);

  // DOM scanning is disabled - no sync needed

  // Register custom card renderers (legacy `cards` prop — uses portals)
  useEffect(() => {
    if (!pillar || !cards) return;

    const unsubscribers: Array<() => void> = [];
    const portalCleanups: Array<() => void> = [];
    let idCounter = 0;

    // Register each card component as a vanilla renderer
    Object.entries(cards).forEach(([cardType, Component]) => {
      const unsubscribe = pillar.registerCard(
        cardType,
        (container, data, callbacks: CardCallbacks) => {
          const portalId = `legacy-card-${cardType}-${idCounter++}`;
          const cleanup = registerPortal(
            portalId,
            container,
            <Component
              data={data}
              onStateChange={callbacks.onStateChange}
            />
          );
          portalCleanups.push(cleanup);
          return cleanup;
        }
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      portalCleanups.forEach((cleanup) => cleanup());
    };
  }, [pillar, cards, registerPortal]);

  // Actions
  const open = useCallback(
    (options?: {
      view?: string;
      article?: string;
      search?: string;
      focusInput?: boolean;
    }) => {
      pillar?.open(options);
    },
    [pillar]
  );

  const close = useCallback(() => {
    pillar?.close();
  }, [pillar]);

  const toggle = useCallback(() => {
    pillar?.toggle();
  }, [pillar]);

  const openArticle = useCallback(
    (slug: string) => {
      pillar?.open({ article: slug });
    },
    [pillar]
  );

  const openCategory = useCallback(
    async (slug: string) => {
      pillar?.navigate("category", { slug });
    },
    [pillar]
  );

  const search = useCallback(
    (query: string) => {
      pillar?.open({ search: query });
    },
    [pillar]
  );

  const navigate = useCallback(
    (view: string, params?: Record<string, string>) => {
      pillar?.navigate(view, params);
    },
    [pillar]
  );

  const setTheme = useCallback(
    (theme: Partial<ThemeConfig>) => {
      pillar?.setTheme(theme);
    },
    [pillar]
  );

  const setTextSelectionEnabled = useCallback(
    (enabled: boolean) => {
      pillar?.setTextSelectionEnabled(enabled);
    },
    [pillar]
  );

  // DOM scanning is disabled - this is a no-op
  const setDOMScanningEnabled = useCallback(
    (_enabled: boolean) => {
      // DOM scanning is disabled - this method has no effect
    },
    []
  );

  const scanPage = useCallback(
    (options?: ScanOptions): CompactScanResult | null => {
      if (!pillar) return null;
      return scanPageDirect(options);
    },
    [pillar]
  );

  const on = useCallback(
    <K extends keyof PillarEvents>(
      event: K,
      callback: (data: PillarEvents[K]) => void
    ) => {
      return pillar?.on(event, callback) ?? (() => {});
    },
    [pillar]
  );

  // Context value
  const value = useMemo<PillarContextValue>(
    () => ({
      pillar,
      state,
      isReady: state === "ready",
      isPanelOpen,
      open,
      close,
      toggle,
      openArticle,
      openCategory,
      search,
      navigate,
      setTheme,
      setTextSelectionEnabled,
      setDOMScanningEnabled,
      isDOMScanningEnabled,
      scanPage,
      on,
    }),
    [
      pillar,
      state,
      isPanelOpen,
      open,
      close,
      toggle,
      openArticle,
      openCategory,
      search,
      navigate,
      setTheme,
      setTextSelectionEnabled,
      setDOMScanningEnabled,
      isDOMScanningEnabled,
      scanPage,
      on,
    ]
  );

  return (
    <PillarContext.Provider value={value}>
      <PortalRegistryContext.Provider value={registerPortal}>
        {children}
        {Array.from(portals.entries()).map(([id, { container, element }]) =>
          createPortal(element, container, id)
        )}
      </PortalRegistryContext.Provider>
    </PillarContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePillarContext(): PillarContextValue {
  const context = useContext(PillarContext);

  if (!context) {
    throw new Error("usePillarContext must be used within a PillarProvider");
  }

  return context;
}

/**
 * Internal hook to access the portal registry.
 * Card components rendered via portals inherit the full host-app React context.
 */
export function usePortalRegistry(): RegisterPortalFn {
  const register = useContext(PortalRegistryContext);

  if (!register) {
    throw new Error(
      "usePortalRegistry must be used within a PillarProvider"
    );
  }

  return register;
}
