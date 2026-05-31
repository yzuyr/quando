// =============================================================================
// quando — typed pattern matching utility
// Zero dependencies. Framework agnostic.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Matcher<TIn, TOut> =
  | { kind: "predicate"; pred: (value: TIn) => boolean; result: TOut | ((value: TIn) => TOut) }
  | {
      kind: "key";
      key: keyof TIn;
      cases: Partial<Record<PropertyKey, TOut | ((value: TIn) => TOut)>>;
    };

// ---------------------------------------------------------------------------
// MatchBuilder
// ---------------------------------------------------------------------------

export interface MatchBuilder<TIn, TOut> {
  /**
   * Apply a result when the predicate returns true.
   *
   * @example
   * match({ disabled: true })
   *   .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
   *   .resolve()
   * // → "opacity-50 cursor-not-allowed"
   */
  when(
    pred: (value: TIn) => boolean,
    result: TOut | ((value: TIn) => TOut),
  ): MatchBuilder<TIn, TOut>;

  /**
   * Switch on a key of the input value, applying a result per matching case.
   * Cases are Partial — unmatched values contribute nothing.
   *
   * @example
   * match({ variant: "primary" })
   *   .when("variant", {
   *     primary:   "bg-indigo-600 text-white",
   *     secondary: "bg-slate-200 text-slate-900",
   *   })
   *   .resolve()
   * // → "bg-indigo-600 text-white"
   */
  when<K extends keyof TIn>(
    key: K,
    cases: Partial<Record<TIn[K] & PropertyKey, TOut | ((value: TIn) => TOut)>>,
  ): MatchBuilder<TIn, TOut>;

  /**
   * Evaluate all registered matchers against the input in registration order
   * and return an array of every matched result.
   *
   * @example
   * match({ variant: "primary", disabled: true })
   *   .when("variant", { primary: "bg-indigo-600" })
   *   .when(({ disabled }) => disabled, "opacity-50")
   *   .all()
   * // → ["bg-indigo-600", "opacity-50"]
   */
  all(): TOut[];

  /**
   * Evaluate all registered matchers and return the first matched result,
   * or `undefined` if nothing matched.
   *
   * @example
   * match({ status: "error" })
   *   .when("status", { ok: "text-green-600", error: "text-red-600" })
   *   .first()
   * // → "text-red-600"
   */
  first(): TOut | undefined;

  /**
   * Evaluate all registered matchers and return the last matched result,
   * or `undefined` if nothing matched. Useful when later matchers are
   * intentionally more specific overrides.
   */
  last(): TOut | undefined;

  /**
   * Evaluate all registered matchers. When `TOut` is `string`, joins all
   * matched results with a space — convenient for composing class strings.
   * When `TOut` is not `string`, behaves identically to `.all()`.
   *
   * @example
   * match({ variant: "primary", disabled: true })
   *   .when("variant", { primary: "bg-indigo-600 text-white" })
   *   .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
   *   .resolve()
   * // → "bg-indigo-600 text-white opacity-50 cursor-not-allowed"
   */
  resolve(): TOut extends string ? string : TOut[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function createMatchBuilder<TIn, TOut>(
  value: TIn,
  matchers: Matcher<TIn, TOut>[],
): MatchBuilder<TIn, TOut> {
  function resolveResult(result: TOut | ((value: TIn) => TOut)): TOut {
    return typeof result === "function" ? (result as (value: TIn) => TOut)(value) : result;
  }

  function evaluate(): TOut[] {
    const results: TOut[] = [];
    for (const matcher of matchers) {
      if (matcher.kind === "predicate") {
        if (matcher.pred(value)) {
          results.push(resolveResult(matcher.result));
        }
      } else {
        const caseResult = matcher.cases[value[matcher.key] as PropertyKey];
        if (caseResult !== undefined) {
          results.push(resolveResult(caseResult));
        }
      }
    }
    return results;
  }

  const builder: MatchBuilder<TIn, TOut> = {
    when(...args: any[]): MatchBuilder<TIn, TOut> {
      if (typeof args[0] === "function") {
        const [pred, result] = args as [(value: TIn) => boolean, TOut | ((value: TIn) => TOut)];
        return createMatchBuilder(value, [...matchers, { kind: "predicate", pred, result }]);
      }
      const [key, cases] = args as [
        keyof TIn,
        Partial<Record<PropertyKey, TOut | ((value: TIn) => TOut)>>,
      ];
      return createMatchBuilder(value, [...matchers, { kind: "key", key, cases }]);
    },

    all(): TOut[] {
      return evaluate();
    },

    first(): TOut | undefined {
      return evaluate()[0];
    },

    last(): TOut | undefined {
      const results = evaluate();
      return results[results.length - 1];
    },

    resolve(): any {
      const results = evaluate();
      if (results.length === 0) return "";
      if (typeof results[0] === "string") {
        return (results as string[]).join(" ");
      }
      return results;
    },
  };

  return builder;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a typed pattern matcher against a plain object value.
 *
 * Chain `.when()` calls to register matchers, then evaluate with `.resolve()`,
 * `.all()`, `.first()`, or `.last()`.
 *
 * The default `TOut` is `string`, making it ergonomic for composing class
 * strings without a type annotation:
 *
 * @example — class string composition (default TOut = string)
 * const classes = match({ variant: "primary", disabled: true, size: "lg" })
 *   .when("variant", {
 *     primary:   "bg-indigo-600 text-white",
 *     secondary: "bg-slate-200 text-slate-900",
 *   })
 *   .when("size", {
 *     sm: "px-2 py-1 text-sm",
 *     md: "px-4 py-2 text-base",
 *     lg: "px-6 py-3 text-lg",
 *   })
 *   .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
 *   .resolve();
 * // → "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed"
 *
 * @example — arbitrary value production (explicit TOut)
 * const icon = match<typeof props, ReactNode>({ status: "error" })
 *   .when("status", {
 *     ok:      <CheckIcon />,
 *     error:   <XIcon />,
 *     pending: <SpinnerIcon />,
 *   })
 *   .first();
 */
export function match<TIn extends Record<string, unknown>>(value: TIn): MatchBuilder<TIn, string>;
export function match<TIn extends Record<string, unknown>, TOut>(
  value: TIn,
): MatchBuilder<TIn, TOut>;
export function match<TIn extends Record<string, unknown>>(value: TIn): MatchBuilder<TIn, any> {
  return createMatchBuilder(value, []);
}

/**
 * Lightweight boolean branch helper. Returns `onTrue(condition)` when the
 * condition is truthy, `null` otherwise — safe for JSX / ilha template
 * interpolation where `false` would render as text but `null` is silently
 * ignored.
 *
 * @example — JSX conditional rendering
 * when(isDisabled, (v) => <span class="badge">{String(v)}</span>)
 * // → <span class="badge">true</span>  |  null
 *
 * @example — conditional class fragment
 * when(isActive, () => "ring-2 ring-indigo-500")
 * // → "ring-2 ring-indigo-500"  |  null
 */
export function when<T>(condition: boolean, onTrue: (value: boolean) => T): T | null;

/**
 * Overload with explicit falsy branch. Returns `onTrue(condition)` when
 * truthy, `onFalse(condition)` otherwise.
 *
 * @example
 * when(
 *   isOnline,
 *   () => "text-green-600",
 *   () => "text-red-500",
 * )
 */
export function when<T, F>(
  condition: boolean,
  onTrue: (value: boolean) => T,
  onFalse: (value: boolean) => F,
): T | F;

export function when<T, F = null>(
  condition: boolean,
  onTrue: (value: boolean) => T,
  onFalse?: (value: boolean) => F,
): T | F | null {
  if (condition) return onTrue(condition);
  if (onFalse) return onFalse(condition);
  return null;
}

/**
 * Merges any number of string values into a single space-separated string,
 * filtering out all falsy values (`null`, `undefined`, `false`, `""`).
 *
 * Useful for composing class strings from `match()` and `when()` results in
 * vanilla TS templates without reaching for an external utility like `clsx`.
 *
 * @example
 * collect(
 *   match(props).when("variant", { primary: "bg-indigo-600" }).resolve(),
 *   when(disabled, () => "opacity-50 cursor-not-allowed"),
 *   when(isActive, () => "ring-2 ring-indigo-500"),
 * )
 * // → "bg-indigo-600 opacity-50 cursor-not-allowed ring-2 ring-indigo-500"
 *
 * @example — empty / all-falsy input
 * collect(null, undefined, false, "")
 * // → ""
 */
export function collect(...values: (string | null | undefined | false)[]): string {
  return values.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// ResourceBuilder — async derived tri-state (ilha DerivedValue)
// ---------------------------------------------------------------------------

/** Matches ilha's `DerivedValue<T>` envelope shape. */
export interface ResourceEnvelope<T> {
  loading: boolean;
  value: T | undefined;
  error: Error | undefined;
}

export interface ResourceWithError<T, TLoading, TErr> {
  ready<TReady>(fn: (value: T | undefined) => TReady): TLoading | TErr | TReady;
}

export interface ResourceWithLoading<T, TLoading> {
  error<TErr>(fn: (error: Error) => TErr): ResourceWithError<T, TLoading, TErr>;
}

export interface ResourceWithErrorOnly<T, TErr> {
  ready<TReady>(fn: (value: T | undefined) => TReady): TErr | TReady;
}

export interface ResourceBuilder<T> {
  loading<TLoading>(fn: () => TLoading): ResourceWithLoading<T, TLoading>;
  error<TErr>(fn: (error: Error) => TErr): ResourceWithErrorOnly<T, TErr>;
  ready<TReady>(fn: (value: T | undefined) => TReady): TReady;
}

function resolveResource<T, TLoading, TErr, TReady>(
  envelope: ResourceEnvelope<T>,
  branches: {
    loading?: () => TLoading;
    error?: (error: Error) => TErr;
    ready: (value: T | undefined) => TReady;
  },
): TLoading | TErr | TReady {
  if (envelope.loading && branches.loading) return branches.loading() as TLoading | TErr | TReady;
  if (envelope.error && branches.error)
    return branches.error(envelope.error) as TLoading | TErr | TReady;
  return branches.ready(envelope.value);
}

/**
 * Tri-state branch helper for async derived values (`loading` / `error` /
 * `ready`). Only the taken branch runs — same lazy semantics as `when()`.
 *
 * @example — ilha island render
 * resource(derived.users)
 *   .loading(() => html`<Spinner />`)
 *   .error((e) => html`<p>${e.message}</p>`)
 *   .ready((users) =>
 *     each(users ?? [])
 *       .key((u) => u.id)
 *       .as((u, _i, id) => Row.key(id)({ user: u }))
 *       .else(() => html`<EmptyState />`),
 *   )
 */
export function resource<T>(envelope: ResourceEnvelope<T>): ResourceBuilder<T> {
  return {
    loading<TLoading>(fn: () => TLoading) {
      return {
        error<TErr>(errorFn: (error: Error) => TErr) {
          return {
            ready<TReady>(readyFn: (value: T | undefined) => TReady) {
              return resolveResource<T, TLoading, TErr, TReady>(envelope, {
                loading: fn,
                error: errorFn,
                ready: readyFn,
              });
            },
          };
        },
      };
    },

    error<TErr>(errorFn: (error: Error) => TErr) {
      return {
        ready<TReady>(readyFn: (value: T | undefined) => TReady) {
          return resolveResource<T, never, TErr, TReady>(envelope, {
            error: errorFn,
            ready: readyFn,
          });
        },
      };
    },

    ready<TReady>(readyFn: (value: T | undefined) => TReady) {
      return resolveResource<T, never, never, TReady>(envelope, { ready: readyFn });
    },
  };
}

import type { NestedSignalAccessor } from "ilha";

// ---------------------------------------------------------------------------
// EachBuilder — Svelte-style {#each}
// ---------------------------------------------------------------------------

/** Symbol description used by Ilha's `SIGNAL_ACCESSOR` (duck-typed at runtime). */
const ILHA_SIGNAL_ACCESSOR = "ilha.signalAccessor";

/** Re-export for consumers pairing quando with ilha >= 0.6.1. */
export type { NestedSignalAccessor };

/** Ilha marked accessor for an array value (`state.todos`). */
export type IlhaArrayAccessor<TItem> = NestedSignalAccessor<readonly TItem[]>;

/** Per-item path accessor from Ilha list `.map()` / `each(accessor)`. */
export type IlhaItemAccessor<TItem> = NestedSignalAccessor<TItem>;

/**
 * Ilha island list accessor with `.map` / nested fields (ilha >= 0.6.1).
 * Pass the accessor itself — **not** `state.todos()`, which snapshots and breaks `bind:`.
 */
export type IlhaListAccessor<TItem> = NestedSignalAccessor<readonly TItem[]>;

/** Mapped list result — usable directly in templates; chain `.else()` for empty fallback. */
export type EachResult<TItem, TOut> = TOut[] & {
  else<TEmpty>(fn: (items: readonly TItem[]) => TEmpty): TOut[] | TEmpty;
};

export interface EachKeyedBuilder<TItem, TKey> {
  as<TOut>(fn: (item: TItem, index: number, key: TKey) => TOut): EachResult<TItem, TOut>;
}

export interface EachBuilder<TItem> {
  key<TKey>(fn: (item: TItem, index: number) => TKey): EachKeyedBuilder<TItem, TKey>;
  as<TOut>(fn: (item: TItem, index: number) => TOut): EachResult<TItem, TOut>;
}

/** Ilha list accessor builder — `.as()` receives per-item accessors; `.key()` receives snapshots. */
export interface EachAccessorKeyedBuilder<TItem, TKey> {
  as<TOut>(
    fn: (item: IlhaItemAccessor<TItem>, index: number, key: TKey) => TOut,
  ): EachResult<IlhaItemAccessor<TItem>, TOut>;
}

export interface EachAccessorBuilder<TItem> {
  key<TKey>(fn: (item: TItem, index: number) => TKey): EachAccessorKeyedBuilder<TItem, TKey>;
  as<TOut>(fn: (item: IlhaItemAccessor<TItem>, index: number) => TOut): EachResult<IlhaItemAccessor<TItem>, TOut>;
}

const __DEV__ = typeof process !== "undefined" ? process.env?.["NODE_ENV"] !== "production" : true;

function hasIlhaSignalBrand(fn: object): boolean {
  return Object.getOwnPropertySymbols(fn).some((s) => s.description === ILHA_SIGNAL_ACCESSOR);
}

/** Duck-type Ilha / alien-signals-style marked accessors (bind:, nested paths). */
export function isSignalAccessor(v: unknown): v is IlhaItemAccessor<unknown> {
  return typeof v === "function" && hasIlhaSignalBrand(v);
}

/** Ilha island array accessor (`state.todos`) with `.map` yielding per-item accessors. */
export function isListAccessor<TItem>(v: unknown): v is IlhaArrayAccessor<TItem> {
  if (!isSignalAccessor(v)) return false;
  return typeof (v as { map?: unknown }).map === "function";
}

function isItemSignalAccessor<T>(item: T | IlhaItemAccessor<T>): item is IlhaItemAccessor<T> {
  return typeof item === "function" && hasIlhaSignalBrand(item);
}

function itemSnapshot<T>(item: T | IlhaItemAccessor<T>): T {
  if (isItemSignalAccessor(item)) return item();
  return item;
}

function createEachResult<TItem, TOut>(
  items: readonly TItem[],
  mapFn: (item: TItem, index: number) => TOut,
): EachResult<TItem, TOut> {
  const mapped = items.length === 0 ? [] : items.map(mapFn);
  const result = mapped as EachResult<TItem, TOut>;
  Object.defineProperty(result, "else", {
    value<TEmpty>(fn: (items: readonly TItem[]) => TEmpty): TOut[] | TEmpty {
      if (items.length === 0) return fn(items);
      return mapped;
    },
    enumerable: false,
  });
  return result;
}

function createEachResultFromAccessor<TItem, TOut>(
  accessor: IlhaArrayAccessor<TItem>,
  mapFn: (item: IlhaItemAccessor<TItem>, index: number) => TOut,
): EachResult<IlhaItemAccessor<TItem>, TOut> {
  const list = accessor as IlhaListAccessor<TItem>;
  const items = accessor();
  const mapped =
    items.length === 0
      ? []
      : list.map((item, index) => mapFn(item, index));
  const result = mapped as EachResult<IlhaItemAccessor<TItem>, TOut>;
  Object.defineProperty(result, "else", {
    value<TEmpty>(fn: (items: readonly TItem[]) => TEmpty): TOut[] | TEmpty {
      const current = accessor();
      if (current.length === 0) return fn(current);
      return mapped;
    },
    enumerable: false,
  });
  return result;
}

function createEachBuilder<TItem>(items: readonly TItem[]): EachBuilder<TItem> {
  return {
    key(keyFn) {
      return {
        as(mapFn) {
          return createEachResult(items, (item, index) =>
            mapFn(item, index, keyFn(item, index)),
          );
        },
      };
    },
    as(mapFn) {
      return createEachResult(items, mapFn);
    },
  };
}

function createEachAccessorBuilder<TItem>(
  accessor: IlhaArrayAccessor<TItem>,
): EachAccessorBuilder<TItem> {
  return {
    key(keyFn) {
      return {
        as(mapFn) {
          return createEachResultFromAccessor(accessor, (item, index) =>
            mapFn(item, index, keyFn(itemSnapshot<TItem>(item), index)),
          );
        },
      };
    },
    as(mapFn) {
      return createEachResultFromAccessor(accessor, mapFn);
    },
  };
}

/**
 * Svelte-style `{#each}` helper for mapping collections to rendered output
 * with an optional empty fallback.
 *
 * Pass an **Ilha list accessor** (`state.todos`) for bindable per-item fields;
 * pass a **plain array** for static data. Do not call the accessor — `each(state.todos())`
 * snapshots and `bind:` will not wire.
 *
 * @example — plain list (empty → [])
 * each(items).as((item) => html`<li>${item.name}</li>`)
 *
 * @example — Ilha bindable list (pass accessor, not snapshot)
 * each(state.todos)
 *   .as((todo) => <Checkbox bind:checked={todo.completed} />)
 *   .else(() => html`<EmptyState />`)
 *
 * @example — keyed ilha island list with empty fallback
 * each(state.todos)
 *   .key((todo) => todo.id)
 *   .as((todo, _i, id) => Row.key(id)({ todo }))
 *   .else(() => html`<EmptyState />`)
 */
export function each<TItem>(items: readonly TItem[]): EachBuilder<TItem>;
export function each<TItem>(accessor: IlhaArrayAccessor<TItem>): EachAccessorBuilder<TItem>;
export function each<TItem>(
  input: readonly TItem[] | IlhaArrayAccessor<TItem>,
): EachBuilder<TItem> | EachAccessorBuilder<TItem> {
  if (isListAccessor<TItem>(input)) {
    return createEachAccessorBuilder(input);
  }
  if (__DEV__ && isSignalAccessor(input)) {
    console.warn(
      "[quando] each(): received a signal accessor where a list was expected. " +
        "Pass the list accessor itself (e.g. each(state.todos)), not a snapshot (each(state.todos())).",
    );
  }
  return createEachBuilder(input as readonly TItem[]);
}
