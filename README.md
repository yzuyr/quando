# quando

> Typed pattern matching utility for TypeScript. Zero dependencies. Framework agnostic.

---

## Install

```bash
npm install quando
# or Bun
bun add quando
```

---

## Overview

**quando** exports five complementary utilities:

| Export               | Purpose                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `match(obj)`         | Chain-style pattern matcher against plain objects — great for composing class strings or deriving values from props |
| `when(bool, ...)`    | Lightweight boolean branch helper — returns `null` on no-match, safe for JSX/template interpolation                 |
| `collect(...values)` | Merges `match()` and `when()` results into a single space-separated string, filtering all falsy values              |
| `each(items)`        | Svelte-style `{#each}` list helper — map items to output with an optional empty fallback                            |
| `resource(envelope)` | Tri-state branch helper for async derived values (`loading` / `error` / `ready`)                                    |

---

## `match()`

Build a typed matcher against a plain object. Chain `.when()` calls to register matchers, then evaluate with `.resolve()`, `.all()`, `.first()`, or `.last()`.

The default `TOut` is `string`, making it ergonomic for Tailwind / CSS-in-JS class composition without any type annotation.

### Predicate form

```ts
import { match } from "quando";

const classes = match({ disabled: true })
  .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
  .resolve();
// → "opacity-50 cursor-not-allowed"
```

### Key switch form

```ts
const classes = match({ variant: "primary" })
  .when("variant", {
    primary: "bg-indigo-600 text-white",
    secondary: "bg-slate-200 text-slate-900",
  })
  .resolve();
// → "bg-indigo-600 text-white"
```

### Combining both — real-world button example

```ts
const classes = match({ variant: "primary", size: "lg", disabled: true })
  .when("variant", {
    primary: "bg-indigo-600 text-white",
    secondary: "bg-slate-200 text-slate-900",
  })
  .when("size", {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  })
  .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
  .resolve();
// → "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed"
```

### Non-string values (explicit `TOut`)

```tsx
import type { ReactNode } from "react";

const icon = match<typeof props, ReactNode>({ status: "error" })
  .when("status", {
    ok: <CheckIcon />,
    error: <XIcon />,
    pending: <SpinnerIcon />,
  })
  .first();
```

### Result functions

Every case value can be a static result **or a function** that receives the full input — useful for derived values:

```ts
match({ size: "lg", scale: 4 })
  .when("size", {
    sm: ({ scale }) => `gap-${scale / 2}`,
    lg: ({ scale }) => `gap-${scale * 2}`,
  })
  .first();
// → "gap-8"
```

### Terminal methods

| Method       | Returns              | Description                                                                 |
| ------------ | -------------------- | --------------------------------------------------------------------------- |
| `.resolve()` | `string` \| `TOut[]` | Joins all matched strings with a space; returns array for non-string `TOut` |
| `.all()`     | `TOut[]`             | All matched results in registration order                                   |
| `.first()`   | `TOut \| undefined`  | First matched result                                                        |
| `.last()`    | `TOut \| undefined`  | Last matched result — useful for override patterns                          |

> **Immutability** — each `.when()` call returns a new builder. The original is never mutated.

---

## `when()`

A boolean branch helper that returns `null` on no-match instead of `false` — because `false` renders as text in JSX/ilha templates while `null` is silently ignored.

Both branch callbacks receive the **condition value** as their argument. This keeps the API consistent and allows the callback to reference it without an outer closure.

### Two-argument form — null on false

```ts
import { when } from "quando";

when(user.isPremium, () => <PremiumBadge />)
// → <PremiumBadge />  or  null

when(isActive, (v) => v ? "ring-2 ring-indigo-500" : "")
// → "ring-2 ring-indigo-500"  or  null
```

### Three-argument form — explicit false branch

```ts
when(
  isOnline,
  () => "text-green-600",
  () => "text-red-500",
);
// → "text-green-600"  or  "text-red-500"
```

Both branches are **lazy** — the thunk for the untaken branch is never called.

The true and false branches may return **different types**:

```ts
when(
  flag,
  () => "active",
  () => 0,
);
// → string | number
```

### JSX template pattern

```tsx
<div class="card">
  {when(user.isPremium, () => (
    <PremiumBadge />
  ))}
  {when(
    count > 0,
    () => (
      <Counter value={count} />
    ),
    () => (
      <EmptyState />
    ),
  )}
</div>
```

---

## `collect()`

Merges any number of string values into a single space-separated string, filtering out all falsy values (`null`, `undefined`, `false`, `""`).

Designed to compose `match()` and `when()` results in vanilla TS templates without reaching for an external utility like `clsx`.

```ts
import { collect } from "quando";

collect("px-4", null, "font-bold", undefined, "text-white");
// → "px-4 font-bold text-white"

collect(null, false, undefined, "");
// → ""
```

### Composing with `when()` and `match()`

```ts
const classes = collect(
  match(props)
    .when("variant", { primary: "bg-indigo-600 text-white", secondary: "bg-slate-200" })
    .when("size", { sm: "px-2 py-1", md: "px-4 py-2", lg: "px-6 py-3" })
    .resolve(),
  when(props.disabled, () => "opacity-50 cursor-not-allowed"),
  when(props.active, () => "ring-2 ring-offset-2 ring-indigo-500"),
);
// → "bg-indigo-600 text-white px-6 py-3 opacity-50 cursor-not-allowed"
```

> For JSX projects that already use `clsx` or `cva`, `collect()` is optional — those libraries own the same space. `collect()` shines in vanilla TS templates where no such utility is present.

---

## `each()`

Svelte-style `{#each}` / `{:else}` for mapping collections to rendered output. Returns an array when items exist, or a single fallback value when the collection is empty.

Both branches are **lazy** — only the taken branch runs.

### Basic list mapping

```ts
import { each } from "quando";

each([1, 2, 3])
  .as((n) => n * 2)
  .all();
// → [2, 4, 6]

each(["a", "b"])
  .as((s, i) => `${i}:${s}`)
  .all();
// → ["0:a", "1:b"]
```

### Empty fallback

```ts
each(items)
  .as((item) => html`<li>${item.name}</li>`)
  .else(() => html`<p>No items</p>`);
// → RawHtml[]  or  RawHtml
```

When the collection is empty, `.else()` runs and receives the empty array. The map function is not called.

### Keyed lists (ilha `Island.key()`)

Use `.key()` when rendering reorderable lists — the key is passed as the third argument to `.as()`:

```ts
each(items)
  .key((item) => item.id)
  .as((item, index, id) => Row.key(id)({ item }))
  .else(() => html`<EmptyState />`);
```

Without `.key()`, use the plain two-argument form:

```ts
each(items)
  .as((item, index) => html`<li>${item.name}</li>`)
  .all();
```

### Terminal methods

| Method    | Returns              | Description                                              |
| --------- | -------------------- | -------------------------------------------------------- |
| `.all()`  | `TOut[]`             | Map every item; empty collection → `[]`                  |
| `.else()` | `TOut[]` \| `TEmpty` | Map every item, or run fallback when collection is empty |

---

## `resource()`

Tri-state branch helper for async derived envelopes — matches [ilha](https://github.com/ilhajs/ilha)'s `DerivedValue<T>` shape (`{ loading, value, error }`).

Branch order is **loading → error → ready**. Only the taken branch runs.

### Full tri-state

```ts
import { each, resource } from "quando";

resource(derived.users)
  .loading(() => html`<Spinner />`)
  .error((e) => html`<p>${e.message}</p>`)
  .ready((users) =>
    each(users ?? [])
      .key((u) => u.id)
      .as((u, _i, id) => Row.key(id)({ user: u }))
      .else(() => html`<EmptyState />`),
  );
```

### Shorthand forms

Skip branches you don't need:

```ts
// error + ready only (no loading UI)
resource(derived.data)
  .error((e) => html`<Error message=${e.message} />`)
  .ready((data) => render(data));

// ready only
resource(derived.count).ready((n) => html`<span>${n ?? 0}</span>`);
```

When `loading` is true and no `.loading()` branch is registered, execution falls through to `.ready()` with `value: undefined`.

---

## Ilha island example

Combining the full API in an island `.render()`:

```ts
.render(({ derived, input }) =>
  html`<ul class="${collect(
    "list",
    when(input.compact, () => "list-compact"),
  )}">
    ${resource(derived.items)
      .loading(() => html`<li class="loading">Loading…</li>`)
      .error((e) => html`<li class="error">${e.message}</li>`)
      .ready((items) =>
        each(items ?? [])
          .key((item) => item.id)
          .as((item, _i, id) => Item.key(id)({ item }))
          .else(() => html`<li class="empty">Nothing here</li>`),
      )}
  </ul>`,
)
```

---

## API reference

```ts
// Object pattern matching
match<TIn, TOut = string>(value: TIn): MatchBuilder<TIn, TOut>

// Boolean branching
when<T>(condition: boolean, onTrue: (value: boolean) => T): T | null
when<T, F>(condition: boolean, onTrue: (value: boolean) => T, onFalse: (value: boolean) => F): T | F

// String merging
collect(...values: (string | null | undefined | false)[]): string

// List rendering
each<TItem>(items: readonly TItem[]): EachBuilder<TItem>
// EachBuilder: .key(fn) → .as(fn) → .else(fn) | .all()
//              .as(fn)  → .else(fn) | .all()

// Async derived tri-state
resource<T>(envelope: ResourceEnvelope<T>): ResourceBuilder<T>
// ResourceEnvelope: { loading: boolean; value: T | undefined; error: Error | undefined }
// ResourceBuilder: .loading(fn) → .error(fn) → .ready(fn)
//                  .error(fn) → .ready(fn)
//                  .ready(fn)
```

---

## Design principles

- **Zero dependencies** — ships nothing but TypeScript source.
- **Immutable builders** — `.when()` always returns a new builder; safe to share and reuse intermediate chains.
- **Lazy evaluation** — result functions and thunks are only called when their branch is taken.
- **`null` not `false`** — `when()` follows JSX conventions so falsy renders are always silent.
- **Value threading** — `when()` passes the condition into both branch callbacks, keeping logic self-contained without outer closures.
- **Composable by design** — all exports are independent but built to work together.
- **Framework agnostic** — works equally in React, Preact, Solid, Svelte, [Ilha](https://github.com/ilhajs/ilha), or plain TS.
- **Svelte-familiar control flow** — `each().as().else()` mirrors `{#each}` / `{:else}`; `resource()` handles async derived envelopes.

---

## License

MIT
