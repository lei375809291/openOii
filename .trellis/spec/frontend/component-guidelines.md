# Component Guidelines

> Patterns, props, composition, and styling for React components.

---

## Stack

- **React 18** with `react-jsx` (no `import React`).
- **TypeScript strict mode** + `noUnusedLocals` + `noUnusedParameters`.
- **Tailwind CSS v4** via `@import "tailwindcss"` in `app/styles/globals.css` (DaisyUI theme on top, "doodle" / "brutal" custom utility classes).
- **`clsx`** for conditional class composition.
- **`@heroicons/react`** for icons.
- **`react-router-dom`** for routing.
- **TanStack Query** for server state, **Zustand** for UI state.

---

## File Layout

- One default-or-named component per file.
- File name = component name in `PascalCase.tsx`.
- Always export as a **named export** (`export function Button(...)`). Lazy imports re-map to `default` at the call site (see `App.tsx`).
- Co-located test: `<Component>.test.tsx`.

---

## Component Anatomy

### Functional, never class

```tsx
import { clsx } from "clsx";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button className={clsx("btn-doodle", variantStyles[variant], sizeStyles[size], className)} {...props}>
      {children}
    </button>
  );
}
```

The only class component allowed is `ErrorBoundary` (React requires it).

### Props are typed with an `interface`

- Named `<Component>Props`.
- Extend native HTML attributes when wrapping a native element (`extends ButtonHTMLAttributes<HTMLButtonElement>`).
- Default values via destructuring, never `defaultProps`.
- `children: ReactNode` when accepting children explicitly.

### Variants as object lookup, not nested ternaries

```tsx
const variantStyles = {
  primary: "bg-primary text-primary-content hover:bg-primary/90",
  ghost: "bg-transparent border-transparent shadow-none",
};
```

Pattern used across `Button.tsx`, `ConfirmModal.tsx`. Don't inline `clsx` ternaries that duplicate what a lookup table already does.

### Forwarding `className`

Always spread `className` last via `clsx`, so callers can override:

```tsx
className={clsx(baseStyles, variantStyles[variant], className)}
```

### Forwarding extra HTML props

Spread the rest with `{...props}` after destructuring the controlled keys. Callers can attach `aria-*`, `data-*`, `id`, `onClick` without the component needing to know.

---

## Composition Patterns

### Children, not "render slots"

Prefer `<Card><Card.Header>...</Card.Header></Card>` or simple `children`. Don't invent `renderHeader={() => ...}` props unless real demand exists.

### Controlled by default

Modals, inputs, and overlays accept `isOpen`, `onClose`, `value`, `onChange`. State is owned by the parent; the component is dumb. See `ConfirmModal.tsx`:

```tsx
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  ...
}
```

### Early returns

When a state means "render nothing," return `null` early:

```tsx
if (!isOpen) return null;
```

### Loading states inside the component

Buttons own their `loading` UI. Pages own their page-level `LoadingOverlay`. Don't push a global spinner for component-local async.

---

## Styling

### Tailwind v4

- Use utility classes directly. No CSS modules, no `styled-components`.
- Theme tokens: `bg-primary`, `text-primary-content`, `bg-base-100`, `border-base-content/30`.
- Project-specific utilities like `btn-doodle`, `shadow-brutal`, `shadow-brutal-sm`, `font-heading`, `touch-target` come from `globals.css`.
- Use `clsx` for conditional classes; never string-concatenate Tailwind classes manually (purger may miss them).
- Don't hardcode hex colors when a theme token exists.

### Responsive

- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`).
- Touch targets must include the `touch-target` utility (see `Button.tsx`) so they meet the 44×44 minimum.

### Dark / light theme

Theme is controlled by `app/stores/themeStore.ts` and toggled at the `<html>` element. Components should rely on theme tokens, not hardcoded `text-white` / `text-black`.

---

## Behavioral Patterns

### Re-click protection on async buttons

`Button.tsx` debounces clicks itself: it sets `isProcessing` while `await onClick?.(e)` runs and re-enables after a 300ms cool-down. Don't re-implement this in a wrapper — wire your async handler into `onClick` and let the button do it.

### Disabled vs loading

- `disabled` = action genuinely unavailable (no permission, missing input).
- `loading` = action in progress (shows spinner, blocks click).
- Both should result in `aria-disabled` and visually muted state.

### Modals and dialogs

Use the project's DaisyUI-flavored `<dialog className="modal modal-open" open>` pattern (see `ConfirmModal.tsx`). New modals should:

- Compose on top of the existing `Modal` primitive when possible.
- Accept `isOpen`/`onClose`.
- Trap focus and close on backdrop click + ESC (the `<dialog>` element handles this in modern browsers; verify in tests).

---

## Forms and Inputs

- `<Input>` (in `components/ui/Input.tsx`) wraps native input with project styling.
- Validation: lift state up to the parent or feature module. Components shouldn't own server-side error messages.
- Display server errors with `<ErrorMessage>` from `components/ui/ErrorMessage.tsx`.

---

## Tests for Components

- Every UI primitive in `components/ui/` ships with a `<Component>.test.tsx`.
- Use `@testing-library/react`, query by accessible role / text, never by classname.
- For interaction tests use `@testing-library/user-event`, not `fireEvent`.
- Mock external dependencies (axios, websocket) at the import boundary, not deep inside.

---

## Forbidden Patterns

| Pattern | Why |
|---|---|
| `React.FC` / `React.FunctionComponent` | Adds implicit `children`; the team uses explicit prop types. |
| `defaultProps` | Use destructuring defaults. |
| `useEffect` to derive state from props | Compute during render; cache with `useMemo` if expensive. |
| Inline `style={{ color: "#fff" }}` | Use Tailwind classes / theme tokens. |
| Direct DOM manipulation (`document.querySelector`, raw `addEventListener`) inside render | Use refs + `useEffect` cleanup; for canvas events use the existing `canvasEvents.ts` helper. |
| `dangerouslySetInnerHTML` without sanitization | Don't accept HTML from users; if unavoidable, sanitize with DOMPurify. |
| Calling axios / fetch directly | Go through `services/api.ts`. |
| Reading from a Zustand store inside a deep ref / class | Use the hook in a function component. |
| Passing entire store objects as props | Pass the slice you need or use a selector. |

---

## Accessibility

- Buttons and links use semantic elements (`<button>`, `<a>`), never `<div onClick>`.
- Iconic-only buttons need `aria-label`.
- Modals announce themselves via `<dialog>`.
- Color is never the only signal of state — pair it with text or icon (e.g., `<ErrorMessage>` includes both icon and copy).

---

## Common Mistakes

1. **Forgetting to forward `className`** — callers can't override layout.
2. **Hardcoding strings inside variants** when the variant set already lives in a sibling component (e.g., redefining `"primary" | "secondary"` everywhere).
3. **Calling `onClick` synchronously and bypassing the Button's debounce** — the wrapper should `await onClick?.(e)`; if it returns `void`, that's still fine.
4. **Importing `react`'s `useState` from a wildcard** — use named imports.
5. **Using `useState(initial)` where `useRef` would do** — re-renders with no purpose.

---

## Examples

- Button with variants + async-click debounce + native HTML props: `app/components/ui/Button.tsx`.
- Variant-styled modal: `app/components/ui/ConfirmModal.tsx`.
- Top-level error boundary: `app/components/ui/ErrorBoundary.tsx`.
- Canvas section composite: `app/components/canvas/InfiniteCanvas.tsx` (+ tests).
- Page wiring lazy-loaded routes: `app/App.tsx`.
