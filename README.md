# @pillar-ai/react

React bindings for [Pillar](https://trypillar.com), the open-source product copilot SDK. Add an AI assistant to your React or Next.js app that executes tasks using your UI. [GitHub](https://github.com/pillarhq/pillar) · [Docs](https://trypillar.com/docs)

[![npm version](https://img.shields.io/npm/v/@pillar-ai/react)](https://www.npmjs.com/package/@pillar-ai/react)
[![npm downloads](https://img.shields.io/npm/dm/@pillar-ai/react)](https://www.npmjs.com/package/@pillar-ai/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

## What is Pillar?

Pillar is a product copilot for SaaS and web apps. Users say what they want, and Pillar uses your UI to make it happen.

A CRM user could ask:

> "Close the Walmart deal as won and notify implementation"

An analytics user could ask:

> "Add a weekly signups chart to my dashboard"

Pillar understands the intent, builds a plan, and executes it client-side with the user's session. No proxy servers, no token forwarding.

## Documentation

[Full docs](https://trypillar.com/docs) · [React quickstart](https://trypillar.com/docs/get-started/quickstart?framework=react) · [API reference](https://trypillar.com/docs/reference)

## Installation

```bash
npm install @pillar-ai/react
# or
pnpm add @pillar-ai/react
# or
yarn add @pillar-ai/react
```

## Quick start

### 1. Get your product key

Sign up at [app.trypillar.com](https://app.trypillar.com) and grab your product key from the dashboard.

### 2. Add the provider

Wrap your app with `PillarProvider`:

```tsx
import { PillarProvider } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider productKey="your-product-key">
      <YourApp />
    </PillarProvider>
  );
}
```

For Next.js App Router, create a client wrapper:

```tsx
// providers/PillarSDKProvider.tsx
'use client';

import { PillarProvider } from '@pillar-ai/react';

export function PillarSDKProvider({ children }: { children: React.ReactNode }) {
  return (
    <PillarProvider productKey="your-product-key">
      {children}
    </PillarProvider>
  );
}
```

```tsx
// app/layout.tsx
import { PillarSDKProvider } from '@/providers/PillarSDKProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PillarSDKProvider>
          {children}
        </PillarSDKProvider>
      </body>
    </html>
  );
}
```

### 3. Define your first tool

Tools tell Pillar what your app can do. Define them with the `usePillarTool` hook:

```tsx
import { usePillarTool } from '@pillar-ai/react';
import { useRouter } from 'next/navigation';

export function usePillarTools() {
  const router = useRouter();

  usePillarTool({
    name: 'open_settings',
    type: 'navigate',
    description: 'Navigate to the settings page',
    examples: ['open settings', 'go to settings'],
    autoRun: true,
    execute: () => router.push('/settings'),
  });
}
```

Call `usePillarTools()` from any component inside `PillarProvider` (e.g. your layout).

## Defining tools

Tools are the building blocks. When a user makes a request, Pillar matches intent to tools and executes them.

### Single tool

```tsx
usePillarTool({
  name: 'open_dashboard',
  type: 'navigate',
  description: 'Navigate to the main dashboard',
  examples: ['go to dashboard', 'show me the dashboard'],
  execute: () => router.push('/dashboard'),
});
```

### Tool with input schema

Pillar extracts parameters from the user's request:

```tsx
usePillarTool({
  name: 'view_user_profile',
  type: 'navigate',
  description: "View a specific user's profile page",
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The user ID to view' },
    },
    required: ['userId'],
  },
  execute: ({ userId }) => router.push(`/users/${userId}`),
});
```

### Multiple tools at once

```tsx
usePillarTool([
  {
    name: 'open_billing',
    type: 'navigate',
    description: 'Navigate to billing and subscription settings',
    examples: ['go to billing', 'view my subscription'],
    execute: () => router.push('/settings/billing'),
  },
  {
    name: 'open_team',
    type: 'navigate',
    description: 'Navigate to team management page',
    examples: ['manage team', 'invite team members'],
    execute: () => router.push('/settings/team'),
  },
]);
```

### Tool types

| Type | Use case |
|------|----------|
| `navigate` | Navigate to a page or view |
| `trigger_tool` | Run a function (export, toggle, API call) |
| `query` | Return data to the assistant |
| `external_link` | Open an external URL |
| `copy_text` | Copy text to clipboard |

See [Setting Up Tools](https://trypillar.com/docs/guides/tools) for the full guide.

## Hooks

### usePillar

Access SDK state and methods:

```tsx
import { usePillar } from '@pillar-ai/react';

function MyComponent() {
  const {
    pillar,      // SDK instance
    isReady,     // Whether SDK is initialized
    isPanelOpen, // Panel open state
    open,        // Open the panel
    close,       // Close the panel
    toggle,      // Toggle the panel
    navigate,    // Navigate to a view
    setTheme,    // Update theme at runtime
    on,          // Subscribe to events
  } = usePillar();

  if (!isReady) return <div>Loading...</div>;

  return <button onClick={() => open()}>Get Help</button>;
}
```

### useHelpPanel

Panel-specific controls:

```tsx
import { useHelpPanel } from '@pillar-ai/react';

function HelpButton() {
  const { isOpen, open, close, toggle, openArticle, openCategory, openSearch, openChat } = useHelpPanel();

  return (
    <div>
      <button onClick={toggle}>{isOpen ? 'Close' : 'Help'}</button>
      <button onClick={openChat}>Ask co-pilot</button>
    </div>
  );
}
```

| Method | Description |
|--------|-------------|
| `open(options?)` | Open the panel |
| `close()` | Close the panel |
| `toggle()` | Toggle open/closed |
| `openArticle(slug)` | Open a specific article |
| `openCategory(slug)` | Open a category view |
| `openSearch(query?)` | Open search with optional query |
| `openChat()` | Open the co-pilot chat view |

## Components

### PillarProvider

The root component. Initializes and configures the SDK.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productKey` | `string` | Yes | Your product key from app.trypillar.com |
| `config` | `object` | No | SDK configuration (panel, theme, triggers) |
| `onTask` | `(task) => void` | No | Generic handler for dynamic tools |
| `cards` | `object` | No | Custom card components for inline tool UI |

```tsx
<PillarProvider
  productKey="your-product-key"
  config={{
    panel: { position: 'right', mode: 'push', width: 400 },
    theme: { mode: 'auto', colors: { primary: '#2563eb' } },
  }}
>
  {children}
</PillarProvider>
```

### PillarPanel

For custom panel placement, set `panel.container` to `'manual'` and render `PillarPanel` where you want it:

```tsx
import { PillarProvider, PillarPanel } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider
      productKey="your-product-key"
      config={{ panel: { container: 'manual' } }}
    >
      <div className="layout">
        <main>Your content</main>
        <PillarPanel className="sidebar-panel" />
      </div>
    </PillarProvider>
  );
}
```

## Generic task handler

For dynamic or backend-triggered tools, use the `onTask` prop on `PillarProvider`. For most cases, prefer `usePillarTool` which co-locates the handler with the tool definition.

```tsx
<PillarProvider
  productKey="your-product-key"
  onTask={(task) => {
    if (task.name.startsWith('nav_')) {
      router.push(task.data.path);
      return;
    }

    switch (task.name) {
      case 'notification':
        showNotification(task.data.message);
        break;
      case 'refresh_data':
        queryClient.invalidateQueries();
        break;
    }
  }}
>
  {children}
</PillarProvider>
```

## Custom cards

Render custom UI for inline tools:

```tsx
import { PillarProvider } from '@pillar-ai/react';
import type { CardComponentProps } from '@pillar-ai/react';
import { InviteMembersCard } from './cards/InviteMembersCard';

<PillarProvider
  productKey="your-product-key"
  cards={{
    invite_members: InviteMembersCard,
  }}
>
  {children}
</PillarProvider>
```

See [Custom Cards](https://trypillar.com/docs/guides/custom-cards) for details.

## Exports

| Export | Description |
|--------|-------------|
| `PillarProvider` | Context provider that initializes the SDK |
| `PillarPanel` | Component for custom panel placement |
| `usePillar` | Hook for SDK access and panel control |
| `useHelpPanel` | Hook for panel-specific controls |
| `usePillarTool` | Hook to register tools |

## Related packages

| Package | Description |
|---------|-------------|
| [@pillar-ai/sdk](https://github.com/pillarhq/sdk) | Core vanilla JS SDK |
| [@pillar-ai/vue](https://github.com/pillarhq/sdk-vue) | Vue 3 bindings |
| [@pillar-ai/svelte](https://github.com/pillarhq/sdk-svelte) | Svelte bindings |

## Requirements

- React 17+ or React 19+
- React DOM 17+ or React DOM 19+

## License

MIT
