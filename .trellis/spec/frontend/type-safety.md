# Type Safety

> TypeScript patterns: shared types, narrowing, validation at IO boundaries.

---

## Compiler Configuration

`frontend/tsconfig.json` is **strict**:

- `"strict": true`
- `"noUnusedLocals": true`
- `"noUnusedParameters": true`
- `"noFallthroughCasesInSwitch": true`
- `"isolatedModules": true`
- `"jsx": "react-jsx"` (no `import React`)
- `"baseUrl": "."` + path alias `"~/*": ["./app/*"]`

`tsc --noEmit` runs as part of `pnpm build`. Do not weaken these flags. If the compiler complains, fix the code, not the config.

---

## Shared Types Live in `app/types/`

- All cross-module types are in `app/types/index.ts` (and split files re-exported from `index.ts` when the file gets large, e.g., `app/types/errors.ts`).
- Import from the alias: `import type { Project, Shot, WsEvent } from "~/types"`.
- Always use `import type` for type-only imports — keeps Vite from emitting unused runtime modules.

### Naming

- Domain entities: `Project`, `Character`, `Shot` — match server schema names.
- Payloads / DTOs: `CreateProjectPayload`, `UpdateProjectPayload`, `ProjectProviderOverridesPayload`.
- Server-pushed event data: `RunProgressEventData`, `RunAwaitingConfirmEventData`, `RunConfirmedEventData`.
- WebSocket envelope: `WsEvent`.
- API helpers may compose: `Partial<Pick<Project, "title" | "story" | "style"> & ProjectProviderOverridesPayload>`.

### Don't duplicate types

If a backend route returns `Project`, the frontend type is a single `Project` in `app/types`. Do not have a parallel `ProjectListItem` that drifts.

---

## Narrowing and Type Guards

The codebase uses small, named guards rather than inline assertions:

```ts
import { isWorkflowStage } from "~/utils/workflowStage";

const stage = data.stage ?? data.current_stage;
if (isWorkflowStage(stage)) {
  store.setCurrentStage(stage);
}
```

When you receive untyped data (`event.data`, `JSON.parse`, `localStorage`), narrow it explicitly. Don't `as` your way out.

### Discriminated unions for events

`WsEvent` is a discriminated union on `type`. The `applyWsEvent` switch in `useWebSocket.ts` lets TypeScript narrow `event.data` per case. Always extend the union when adding a new event:

```ts
type WsEvent =
  | { type: "run_started"; data: RunStartedEventData }
  | { type: "run_progress"; data: RunProgressEventData }
  | ...
```

### Switch exhaustiveness

`noFallthroughCasesInSwitch` is on. Default cases that re-throw or assert never can be added when you want exhaustiveness checking:

```ts
default: {
  const _exhaustive: never = event;
  throw new Error(`Unknown event: ${JSON.stringify(_exhaustive)}`);
}
```

The current `applyWsEvent` switch doesn't add `default` because it intentionally ignores unknown event types (forward-compat with newer servers). If you add a critical control event, prefer exhaustiveness.

---

## API Boundary Typing

`app/services/api.ts` is the only module allowed to call `axios`. Each function declares the request and response types explicitly, e.g.:

```ts
export async function getProject(id: number): Promise<Project> {
  const res = await axios.get<Project>(`${API_BASE}/api/v1/projects/${id}`);
  return res.data;
}
```

Rules:

- Return concrete entity types (`Promise<Project>`), never `Promise<any>` or `Promise<unknown>`.
- Validate at the boundary if the server's contract is fragile. Today the project trusts the backend's Pydantic response models. If we add Zod or similar, it goes here.

---

## WebSocket Boundary

`event.data` is typed as `Record<string, unknown>` for some legacy events. The reducer uses targeted casts only after a guard:

```ts
const progressEvent = event.data as unknown as RunProgressEventData;
```

This is acceptable **only** because the surrounding case has already discriminated `event.type`. If you add a new event, prefer modeling its `data` as a typed property of the union variant from the start, so casts disappear.

---

## Generics

Use generics on:

- Reusable hooks that wrap something (`useQuery<TData>`).
- Utility functions like `clearLoadingStates(store, agentFilter?)` — keep them concrete unless they're truly polymorphic.
- API helpers when the response shape varies by argument.

Avoid one-off generics; concrete types read more clearly and refactor faster.

---

## Forbidden

| Pattern | Why |
|---|---|
| `any` | Strict mode permits it but project rule forbids it. Use `unknown` and narrow. |
| `as any` | Same as above. |
| `// @ts-ignore`, `// @ts-expect-error` | Forbidden. Solve the type issue. |
| Empty `catch (e) {}` | At minimum log the error. |
| `Function` type | Use a concrete signature `(...args: T[]) => R`. |
| `Object` / `{}` types | Use `Record<string, unknown>` or model the shape. |
| Untyped `JSON.parse` in production code | Wrap with a guard or schema. |
| Importing types without `import type` for type-only usage | Bundler emits dead runtime imports. |
| Type assertions to "fix" missing fields (`{ ... } as Foo`) | Make the data legitimately match `Foo` or extend the type. |

---

## Patterns That Work Well Here

### `Record<string, unknown>` for opaque server payloads

Carry untrusted JSON as `Record<string, unknown>` until it's narrowed.

### Optional chaining + nullish coalescing for server defaults

```ts
const stage = data.stage ?? data.current_stage;
```

Both fields may be present in different versions of the server payload — read defensively at the boundary.

### Function types for store actions

Action signatures live in the store interface so consumers see typed selectors:

```ts
interface ToastStore {
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}
```

### Compose with utility types

```ts
export type UpdateProjectPayload = Partial<
  Pick<Project, "title" | "story" | "style"> & ProjectProviderOverridesPayload
>;
```

`Partial`, `Pick`, `Omit`, `ReturnType<typeof setTimeout>` are preferred over hand-written shapes.

---

## Common Mistakes

1. **Adding optional `?` to silence the compiler** when the field is actually required. Make the call site provide it instead.
2. **`as Foo` to bypass missing fields** — leads to runtime undefined. Either widen `Foo` or fix the data.
3. **Importing types from `~/types` without `import type`** — Vite tree-shakes less aggressively.
4. **Defining the same DTO type in two places** (component + store + API) and watching them drift.
5. **Casting `event.target`** in event handlers without checking the element kind. Use `e.currentTarget` or check `instanceof HTMLInputElement` first.

---

## Review Checklist

Before opening a PR with type changes:

- [ ] No new `any` / `as any` / `@ts-ignore`.
- [ ] All cross-boundary data types live in `app/types/`.
- [ ] New event types are added to `WsEvent` and handled in `applyWsEvent`.
- [ ] `pnpm exec tsc --noEmit` passes.
- [ ] `pnpm build` passes (it includes the type check).

---

## Examples

- Domain types: `app/types/index.ts`.
- Discriminated WS events: `WsEvent` definition in `app/types`, dispatched in `app/hooks/useWebSocket.ts`.
- Type-narrowing utility: `app/utils/workflowStage.ts`.
- Backend-base resolver with typed options: `app/utils/runtimeBase.ts`.
- API surface with typed responses: `app/services/api.ts`.
