# @pillar-ai/react

React bindings for the Pillar Embedded Help SDK — Add contextual help and AI-powered assistance to your React application.

[![npm version](https://img.shields.io/npm/v/@pillar-ai/react)](https://www.npmjs.com/package/@pillar-ai/react)
[![npm downloads](https://img.shields.io/npm/dm/@pillar-ai/react)](https://www.npmjs.com/package/@pillar-ai/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

## Features

- **React Hooks** — `usePillar` and `useHelpPanel` for idiomatic React integration
- **Components** — `PillarProvider`, `PillarPanel`, and `Tooltip` components
- **Next.js Support** — Works with Next.js App Router and Pages Router
- **Type-Safe Actions** — Full TypeScript support for custom actions
- **Custom Cards** — Render custom UI for inline actions

## Documentation

**[View Full Documentation](https://trypillar.com/docs)** | [React Guide](https://trypillar.com/docs/react/installation) | [API Reference](https://trypillar.com/docs/reference/react)

## Installation

```bash
npm install @pillar-ai/react
# or
pnpm add @pillar-ai/react
# or
yarn add @pillar-ai/react
```

## Quick Start

Wrap your app with `PillarProvider`:

```tsx
import { PillarProvider } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider helpCenter="your-help-center">
      <MyApp />
    </PillarProvider>
  );
}
```

### Next.js App Router

For Next.js App Router, create a client wrapper component:

```tsx
// providers/PillarClientProvider.tsx
'use client';

import { PillarProvider } from '@pillar-ai/react';

export function PillarClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <PillarProvider helpCenter="your-help-center">
      {children}
    </PillarProvider>
  );
}

// app/layout.tsx
import { PillarClientProvider } from '@/providers/PillarClientProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PillarClientProvider>{children}</PillarClientProvider>
      </body>
    </html>
  );
}
```

## Components

### PillarProvider

The root provider that initializes the SDK and provides context to child components.

```tsx
<PillarProvider
  helpCenter="your-help-center"
  config={{
    panel: { position: 'right', mode: 'push' },
    edgeTrigger: { enabled: true },
    theme: { mode: 'auto' },
  }}
>
  {children}
</PillarProvider>
```

### Custom Trigger Button

To use your own button instead of the built-in edge trigger:

```tsx
<PillarProvider
  helpCenter="your-help-center"
  config={{ edgeTrigger: { enabled: false } }}
>
  <MyApp />
</PillarProvider>

function HelpButton() {
  const { toggle } = useHelpPanel();
  return <button onClick={toggle}>Get Help</button>;
}
```

### Tooltip

Attach contextual tooltips to any element:

```tsx
import { Tooltip } from '@pillar-ai/react';

<Tooltip tooltipId="welcome-tooltip">
  <button>Hover me for help</button>
</Tooltip>;
```

### PillarPanel

For custom panel placement (when using `container: 'manual'`):

```tsx
import { PillarProvider, PillarPanel } from '@pillar-ai/react';

function App() {
  return (
    <PillarProvider
      helpCenter="your-help-center"
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

## Hooks

### usePillar

Access the SDK instance and state:

```tsx
import { usePillar } from '@pillar-ai/react';

function MyComponent() {
  const { isReady, isOpen, pillar } = usePillar();

  if (!isReady) return <div>Loading...</div>;

  return <div>Panel is {isOpen ? 'open' : 'closed'}</div>;
}
```

### useHelpPanel

Control the help panel:

```tsx
import { useHelpPanel } from '@pillar-ai/react';

function HelpButton() {
  const { open, close, toggle, isOpen } = useHelpPanel();

  return (
    <button onClick={toggle}>{isOpen ? 'Close Help' : 'Get Help'}</button>
  );
}
```

## Type-Safe Actions

Define custom actions with full TypeScript support:

```tsx
import { PillarProvider, usePillar } from '@pillar-ai/react';
import type { ActionDefinitions } from '@pillar-ai/react';

// Define your actions
const actions = {
  openSettings: {
    type: 'navigate' as const,
    label: 'Open Settings',
    description: 'Navigate to settings page',
  },
  showNotification: {
    type: 'trigger' as const,
    label: 'Show Notification',
    description: 'Display a notification',
    dataSchema: {
      message: { type: 'string' as const, required: true },
    },
  },
} satisfies ActionDefinitions;

function App() {
  return (
    <PillarProvider
      helpCenter="your-help-center"
      actions={actions}
      onTask={(type, data) => {
        // TypeScript knows the exact shape of data based on type
        if (type === 'showNotification') {
          console.log(data.message); // Typed!
        }
      }}
    >
      <MyApp />
    </PillarProvider>
  );
}
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@pillar-ai/sdk](https://github.com/pillarhq/sdk) | Core vanilla JavaScript SDK |
| [@pillar-ai/vue](https://github.com/pillarhq/sdk-vue) | Vue 3 bindings |
| [@pillar-ai/svelte](https://github.com/pillarhq/sdk-svelte) | Svelte bindings |

## Requirements

- React 17.0.0 or higher
- React DOM 17.0.0 or higher

## License

MIT
