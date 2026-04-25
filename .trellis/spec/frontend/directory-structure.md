# Directory Structure

> How frontend code is organized in `frontend/app/`.

---

## Overview

Vite + React 18 + TypeScript SPA. State is split between Zustand stores (UI/local) and TanStack Query (server data). Routing uses `react-router-dom`. Tests run on Vitest + Testing Library; E2E on Playwright.

Entry: `frontend/app/main.tsx` → renders `<App />` from `App.tsx`. Routes are declared in `App.tsx` with `lazy()` per page.

---

## Directory Layout

```
frontend/app/
├── main.tsx                # Entry: ReactDOM.createRoot, conditional MSW worker
├── App.tsx                 # Router, providers (QueryClient, ErrorBoundary), global modals/toasts
├── setupTests.ts           # Vitest setup (Testing Library matchers, mocks)
├── vite-env.d.ts           # Vite type ambient
│
├── components/             # Reusable UI building blocks
│   ├── ui/                 # Generic primitives: Button, Card, Modal, Input, ConfirmModal, ErrorBoundary, ...
│   ├── canvas/             # Infinite canvas surface + section shapes
│   ├── chat/               # Chat / orchestrator UI
│   ├── layout/             # Page-level layout wrappers
│   ├── project/            # Project-detail composites
│   ├── settings/           # SettingsModal + provider config UI
│   └── toast/              # ToastContainer + Toast item
│
├── features/               # Use-case modules (one folder per cohesive feature)
│   └── projects/           # e.g., deleteProject.ts (mutations + tests)
│
├── pages/                  # One file per route (HomePage, ProjectsPage, NewProjectPage, ProjectPage)
│
├── hooks/                  # Cross-cutting hooks (useWebSocket, useCanvasLayout)
│
├── stores/                 # Zustand stores (one file per store)
│
├── services/               # Backend API client (api.ts)
│
├── types/                  # Project-wide TypeScript types (index.ts re-exports)
│
├── utils/                  # Pure helpers (runtimeBase, format, urls, ...)
│
├── styles/                 # Global CSS (globals.css with Tailwind v4 @import)
│
└── mocks/                  # MSW handlers (only loaded when VITE_ENABLE_MSW=true)
```

E2E tests live in `frontend/tests/e2e/` (configured via `frontend/playwright.config.ts`).

---

## Where Things Go

### A new page

1. Create `app/pages/<Name>Page.tsx` exporting a named `<Name>Page` component.
2. Register a route in `app/App.tsx` with `lazy()` matching the existing pattern.
3. Add a Vitest unit test next to the page: `<Name>Page.test.tsx`.
4. Add an E2E flow under `frontend/tests/e2e/` if the page has user-visible flows.

### A reusable UI primitive

- Goes in `app/components/ui/`.
- Must be domain-agnostic (no project-specific words in the API).
- Co-located test file: `<Name>.test.tsx`.

### A domain composite (project, settings, canvas)

- Goes in the matching `app/components/<domain>/` folder.
- May depend on `app/components/ui/` primitives, stores, services.

### A feature mutation / workflow

- Goes in `app/features/<feature>/<action>.ts`.
- Pattern is one file per action, paired with `<action>.test.ts`. See `app/features/projects/deleteProject.ts`.

### A custom hook

- Cross-cutting hook (used by 2+ unrelated components): `app/hooks/<useThing>.ts`.
- Component-specific hook: keep it inside the same folder as the component.

### A Zustand store

- One file per store under `app/stores/`. Naming: `<purpose>Store.ts` (e.g., `editorStore.ts`, `settingsStore.ts`, `sidebarStore.ts`, `themeStore.ts`, `toast.store.ts`).
- Test file co-located: `<store>.test.ts` (see `editorStore.test.ts`).

### A backend API call

- All HTTP goes through `app/services/api.ts` (axios-based). Add a typed function there; do not call `axios` directly from a component or hook.
- Tests for the client: `app/services/api.test.ts`.

### A shared type

- Add to `app/types/<domain>.ts` and re-export from `app/types/index.ts`.

### A util

- Pure functions only. Goes in `app/utils/<topic>.ts`.
- Use `app/utils/runtimeBase.ts` for resolving the API/WS base URL — do not hand-build URLs in components.

---

## Path Aliases

Configured in `tsconfig.json` and `vite.config.ts`:

```ts
"paths": { "~/*": ["./app/*"] }
```

Use `~/components/...`, `~/services/api`, `~/stores/editorStore` consistently. Avoid deep relative paths (`../../../`) when an alias works.

---

## Naming Conventions

- **Components / Pages**: `PascalCase.tsx` (`Button.tsx`, `ProjectPage.tsx`).
- **Hooks**: `useXxx.ts` (camelCase, prefix `use`).
- **Stores**: `<purpose>Store.ts`, exported hook `useXxxStore`. Keep selectors close to the store.
- **Utilities**: `camelCase.ts`.
- **Tests**: same name as source + `.test.ts(x)`, sitting next to the source file.
- **MSW handlers**: `app/mocks/handlers.ts` (and `app/mocks/browser.ts` for the worker).

---

## Lazy Loading & Code Splitting

Pages are lazy-loaded in `App.tsx`:

```tsx
const ProjectPage = lazy(() => import("./pages/ProjectPage").then(m => ({ default: m.ProjectPage })));
```

`<Suspense fallback={<LoadingOverlay text="加载中..." />}>` wraps the route tree. New top-level pages should follow the same `lazy()` import pattern.

Heavy in-page widgets (e.g., a 200KB canvas tool) can be lazy-loaded inside the page. Don't lazy-load tiny components.

---

## Globals Mounted Once

`<App />` mounts three globals at the root:

- `<ErrorBoundary>` — catches render errors in the route tree.
- `<SettingsModal />` — triggered from anywhere via the settings store.
- `<ToastContainer />` — driven by `app/stores/toast.store.ts`.

If you add another globally-controlled overlay (e.g., a global confirm), follow the same pattern: a Zustand store + a single mount inside `<App />`.

---

## Examples

- Page wired into the router: `app/App.tsx` + `app/pages/ProjectPage.tsx`.
- UI primitive with co-located test: `app/components/ui/Button.tsx` + `Button.test.tsx`.
- Feature mutation: `app/features/projects/deleteProject.ts` + `deleteProject.test.ts`.
- Cross-cutting hook: `app/hooks/useWebSocket.ts`.
- Zustand store with tests: `app/stores/editorStore.ts` + `editorStore.test.ts`.
- API client surface: `app/services/api.ts`.
- Runtime base URL resolver (used by `services/api.ts` and `useWebSocket`): `app/utils/runtimeBase.ts`.
