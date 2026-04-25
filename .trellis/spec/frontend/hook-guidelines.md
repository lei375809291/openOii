# Hook Guidelines

> Custom React hooks: when to write them, naming, and data-fetching patterns.

---

## When to Write a Custom Hook

Write a hook when:

- You have **stateful logic** (`useState`, `useEffect`, `useRef`) that needs to be reused in 2+ components.
- You're integrating with an **external system** (WebSocket, IndexedDB, browser API, third-party widget) and want a clean React-friendly API.
- You're combining several primitives into one **opinionated pattern** (e.g., `useCanvasLayout` orchestrates layout state + window resize listening).

Do **not** write a hook when:

- A pure function is enough (use `app/utils/`).
- A Zustand selector solves it (use `useEditorStore(state => state.x)` directly).
- TanStack Query already does it (`useQuery` / `useMutation`).

---

## Naming and Location

- Name: `use<Thing>` in **camelCase**, file `useThing.ts`.
- Cross-cutting hook (used by 2+ unrelated components): `app/hooks/<useThing>.ts`.
- Component-private hook: keep it next to the component, in the same file or a sibling file. Don't pollute `app/hooks/` with one-off helpers.
- Test file co-located: `useThing.test.ts`.

---

## Rules of Hooks (mandatory)

- Call hooks at the top level of a component or another hook.
- Never inside conditions, loops, or callbacks.
- Always exhaustive `useEffect` / `useCallback` deps unless you have a documented reason. Lint enforces this.

---

## Data Fetching: TanStack Query

Server state lives in TanStack Query. The `QueryClient` is configured once in `App.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
```

### Patterns

```tsx
// Query
const { data, isLoading, error } = useQuery({
  queryKey: ["projects", projectId],
  queryFn: () => api.getProject(projectId),
});

// Mutation with cache invalidation
const queryClient = useQueryClient();
const deleteMutation = useMutation({
  mutationFn: api.deleteProject,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  },
});
```

### Conventions

- All HTTP goes through `app/services/api.ts` — never call `axios` from the queryFn directly.
- Query keys are arrays starting with the resource: `["projects"]`, `["projects", id]`, `["projects", id, "characters"]`. Be consistent so invalidation works.
- For mutations that affect a list, invalidate the list key on success.
- Use `enabled: !!id` to gate queries on input availability rather than wrapping `useQuery` in a conditional.

### Errors and loading

Render `isLoading`, `error`, and `data` paths explicitly. Don't try to hide loading by silent fallbacks.

---

## WebSocket: `useProjectWebSocket`

The WS integration is centralized in `app/hooks/useWebSocket.ts`. Read its design before adding another WS connection.

### Public surface

```ts
const { send, disconnect, reconnect } = useProjectWebSocket(projectId);
```

### Behaviors implemented (do not duplicate)

- **Singleton per `projectId`** via a module-level `globalConnections: Map<number, WebSocket>` to survive React 18 StrictMode double-invocation.
- **Auto-reconnect** up to `MAX_RECONNECT_ATTEMPTS` (5) with `RECONNECT_DELAY` (3000 ms) backoff.
- **Toast feedback** for first connection drop, reconnection success, and final-failure.
- **Event dispatch** through the pure `applyWsEvent(event, store)` function, which is exported separately and is the part you unit-test (see `useWebSocket.test.ts`).

### When extending

- **Adding an event type**: add it to `WsEvent` in `app/types/index.ts`, then add a `case` to the `switch` in `applyWsEvent`. Keep the case body small — most just call store setters and add a system message.
- **Don't open a second WebSocket** for the same project. Reuse this hook.
- **Keep `applyWsEvent` pure** (no React imports, no `toast.*` for routine state updates) so it stays unit-testable. Side-effects like toasts only for true error events.
- **Dev-only logging**: gate `console.log` / `console.error` with `if (import.meta.env.DEV)` — see existing patterns.

---

## Effects (`useEffect`)

### Rules

- Always return a cleanup function when you subscribe (event listener, timer, observer, WS).
- Use `useRef` for values you want to persist across renders without triggering re-renders (timers, counters).
- Use `useCallback` for functions in deps to keep effects stable.

### Avoid

- "Sync prop into state" effects. Compute during render or `useMemo` instead.
- Effects that fire fetch — use TanStack Query.
- Effects that read from the DOM after mount when a ref + cleanup would do.

---

## Refs

```tsx
const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Use `ReturnType<typeof setTimeout>` (not `number` / `NodeJS.Timeout`) for cross-environment safety.

---

## Memoization

`useMemo` / `useCallback` are not free. Use them when:

- The value goes into another hook's dependency array.
- Avoiding the recomputation has measurable benefit (large lists, expensive derivations).

Don't sprinkle them on every variable — strict mode + linter will catch the cases that matter.

---

## Tests for Hooks

- Use `@testing-library/react`'s `renderHook` and `act`.
- For hooks that read from a store, set the store directly via the store's `setState` (don't render a component just to mock).
- For `useProjectWebSocket`, the tests target the pure `applyWsEvent` function — that's the design lesson: extract pure logic from your hook so unit tests don't need a real WebSocket.
- Mock `axios` (or the `services/api.ts` module) at the test boundary, not deep inside.

Example shape (paraphrased from `useWebSocket.test.ts`):

```ts
import { applyWsEvent } from "./useWebSocket";

it("run_failed clears generating + adds error message", () => {
  const store = makeFakeStore();
  applyWsEvent({ type: "run_failed", data: { error: "boom" } }, store);
  expect(store.generating).toBe(false);
  expect(store.messages.at(-1)?.role).toBe("error");
});
```

---

## Forbidden Patterns

| Pattern | Why |
|---|---|
| Calling `fetch` / `axios` directly inside `useEffect` | Use TanStack Query or call `services/api.ts`. |
| Manually managing query loading flags (`useState<boolean>` for loading) | Let `useQuery` own it. |
| `useEffect(() => setState(deriveFrom(props)))` | Compute during render. |
| Subscribing to a DOM event without cleanup | Memory leak. |
| Reading from a Zustand store via `getState()` inside render | Use the hook so React subscribes to changes. |
| Opening a second WebSocket per-component | Reuse `useProjectWebSocket`. |
| Dropping deps with `// eslint-disable-line react-hooks/exhaustive-deps` without a comment | Add a real explanation if you must. |

---

## Common Mistakes

1. **Forgetting cleanup**, leading to subscriptions surviving unmount and double-firing in StrictMode.
2. **Putting toast / navigation side-effects inside `applyWsEvent`** — makes it untestable. Keep them in the hook closure.
3. **Re-fetching on every keystroke** — debounce input or move query keys to stable values.
4. **Returning unstable function references** that cause downstream effects to fire — wrap in `useCallback`.
5. **Calling `useState` to store a value that never triggers a render** — use `useRef`.

---

## Examples

- WebSocket hook + pure event reducer: `app/hooks/useWebSocket.ts` + `useWebSocket.test.ts`.
- Layout hook: `app/hooks/useCanvasLayout.ts`.
- Feature mutation (suitable for `useMutation`): `app/features/projects/deleteProject.ts`.
- Runtime base URL helper used inside hooks: `app/utils/runtimeBase.ts`.
