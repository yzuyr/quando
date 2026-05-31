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

// ---------------------------------------------------------------------------
// EachBuilder — Svelte-style {#each}
// ---------------------------------------------------------------------------

export interface EachWithAs<TItem, TOut> {
  else<TEmpty>(fn: (items: readonly TItem[]) => TEmpty): TOut[] | TEmpty;
  all(): TOut[];
}

export interface EachKeyedBuilder<TItem, TKey> {
  as<TOut>(fn: (item: TItem, index: number, key: TKey) => TOut): EachWithAs<TItem, TOut>;
}

export interface EachBuilder<TItem> {
  key<TKey>(fn: (item: TItem, index: number) => TKey): EachKeyedBuilder<TItem, TKey>;
  as<TOut>(fn: (item: TItem, index: number) => TOut): EachWithAs<TItem, TOut>;
}

function createEachWithAs<TItem, TOut>(
  items: readonly TItem[],
  mapFn: (item: TItem, index: number) => TOut,
): EachWithAs<TItem, TOut> {
  return {
    else(fn) {
      if (items.length === 0) return fn(items);
      return items.map(mapFn);
    },
    all() {
      return items.map(mapFn);
    },
  };
}

function createEachBuilder<TItem>(items: readonly TItem[]): EachBuilder<TItem> {
  return {
    key(keyFn) {
      return {
        as(mapFn) {
          return createEachWithAs(items, (item, index) => mapFn(item, index, keyFn(item, index)));
        },
      };
    },
    as(mapFn) {
      return createEachWithAs(items, mapFn);
    },
  };
}

/**
 * Svelte-style `{#each}` helper for mapping collections to rendered output
 * with an optional empty fallback.
 *
 * @example — keyed ilha island list
 * each(items)
 *   .key((item) => item.id)
 *   .as((item, _i, id) => Row.key(id)({ item }))
 *   .else(() => html`<EmptyState />`)
 */
export function each<TItem>(items: readonly TItem[]): EachBuilder<TItem> {
  return createEachBuilder(items);
}
