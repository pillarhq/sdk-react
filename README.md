# @pillar-ai/react

React bindings for the Pillar Embedded Help SDK.

## Installation

```bash
npm install @pillar-ai/react
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

## License

MIT
