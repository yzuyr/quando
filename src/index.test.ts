// =============================================================================
// quando — test suite
// =============================================================================

import { describe, it, expect } from "bun:test";

import { match, when, collect, each, resource } from "./index";

// ---------------------------------------------------------------------------
// match()
// ---------------------------------------------------------------------------

describe("match()", () => {
  it("returns a builder with when, all, first, last, resolve", () => {
    const builder = match({ x: 1 });
    expect(typeof builder.when).toBe("function");
    expect(typeof builder.all).toBe("function");
    expect(typeof builder.first).toBe("function");
    expect(typeof builder.last).toBe("function");
    expect(typeof builder.resolve).toBe("function");
  });

  it("is immutable — each .when() returns a new builder", () => {
    const a = match({ x: 1 });
    const b = a.when(({ x }) => x === 1, "hit");
    expect(a).not.toBe(b);
    expect(a.all()).toEqual([]);
    expect(b.all()).toEqual(["hit"]);
  });
});

// ---------------------------------------------------------------------------
// .when() — predicate form
// ---------------------------------------------------------------------------

describe(".when() predicate form", () => {
  it("matches when predicate returns true", () => {
    const result = match({ disabled: true })
      .when(({ disabled }) => disabled, "opacity-50")
      .all();
    expect(result).toEqual(["opacity-50"]);
  });

  it("does not match when predicate returns false", () => {
    const result = match({ disabled: false })
      .when(({ disabled }) => disabled, "opacity-50")
      .all();
    expect(result).toEqual([]);
  });

  it("accepts a result function — receives the full input value", () => {
    const result = match({ count: 7 })
      .when(
        ({ count }) => count > 0,
        ({ count }) => `${count} items`,
      )
      .first();
    expect(result).toBe("7 items");
  });

  it("evaluates multi-field predicates", () => {
    const result = match({ variant: "primary", disabled: false })
      .when(({ variant, disabled }) => variant === "primary" && !disabled, "bg-indigo-600")
      .first();
    expect(result).toBe("bg-indigo-600");
  });

  it("multiple predicate whens are all evaluated independently", () => {
    const result = match({ bold: true, italic: true, underline: false })
      .when(({ bold }) => bold, "font-bold")
      .when(({ italic }) => italic, "italic")
      .when(({ underline }) => underline, "underline")
      .all();
    expect(result).toEqual(["font-bold", "italic"]);
  });

  it("is chainable — returns a MatchBuilder", () => {
    const builder = match({ x: 1 }).when(() => true, "a");
    expect(typeof builder.when).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// .when() — key switch form
// ---------------------------------------------------------------------------

describe(".when() key switch form", () => {
  it("matches the correct case", () => {
    const result = match({ variant: "primary" })
      .when("variant", {
        primary: "bg-indigo-600 text-white",
        secondary: "bg-slate-200 text-slate-900",
      })
      .first();
    expect(result).toBe("bg-indigo-600 text-white");
  });

  it("matches each case independently", () => {
    expect(
      match({ variant: "secondary" })
        .when("variant", { primary: "bg-indigo-600", secondary: "bg-slate-200" })
        .first(),
    ).toBe("bg-slate-200");
  });

  it("emits nothing for an unhandled case (Partial)", () => {
    const result = match({ variant: "ghost" as string })
      .when("variant", { primary: "bg-indigo-600", secondary: "bg-slate-200" })
      .all();
    expect(result).toEqual([]);
  });

  it("accepts a result function — receives the full input value", () => {
    const result = match({ size: "lg", base: 4 })
      .when("size", {
        sm: ({ base }) => `p-${base / 2}`,
        lg: ({ base }) => `p-${base * 2}`,
      })
      .first();
    expect(result).toBe("p-8");
  });

  it("multiple key whens are all evaluated independently", () => {
    const result = match({ variant: "primary", size: "sm" })
      .when("variant", {
        primary: "bg-indigo-600 text-white",
        secondary: "bg-slate-200 text-slate-900",
      })
      .when("size", {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
      })
      .all();
    expect(result).toEqual(["bg-indigo-600 text-white", "px-2 py-1 text-sm"]);
  });

  it("is chainable — returns a MatchBuilder", () => {
    const builder = match({ x: "a" }).when("x", { a: "hit" });
    expect(typeof builder.when).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Mixed predicate + key switch
// ---------------------------------------------------------------------------

describe("mixed .when() calls", () => {
  it("evaluates predicate and key matchers in registration order", () => {
    const result = match({ variant: "primary", disabled: true })
      .when("variant", {
        primary: "bg-indigo-600 text-white",
        secondary: "bg-slate-200 text-slate-900",
      })
      .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
      .all();
    expect(result).toEqual(["bg-indigo-600 text-white", "opacity-50 cursor-not-allowed"]);
  });

  it("preserves order — predicate first, then key", () => {
    const result = match({ variant: "secondary", flag: true })
      .when(({ flag }) => flag, "first")
      .when("variant", { secondary: "second" })
      .all();
    expect(result).toEqual(["first", "second"]);
  });

  it("full real-world example — button props to class string", () => {
    const props: {
      variant: "primary" | "secondary";
      size: "sm" | "md" | "lg";
      disabled: boolean;
    } = { variant: "primary", size: "lg", disabled: true };

    const classes = match(props)
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

    expect(classes).toBe(
      "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed",
    );
  });
});

// ---------------------------------------------------------------------------
// .all()
// ---------------------------------------------------------------------------

describe(".all()", () => {
  it("returns an empty array when nothing matches", () => {
    expect(
      match({ x: false })
        .when(({ x }) => x, "hit")
        .all(),
    ).toEqual([]);
  });

  it("returns all matched results in order", () => {
    const result = match({ a: true, b: true, c: false })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .when(({ c }) => c, "C")
      .all();
    expect(result).toEqual(["A", "B"]);
  });

  it("can return multiple results from key matchers", () => {
    const result = match({ x: "foo", y: "bar" })
      .when("x", { foo: "matched-x" })
      .when("y", { bar: "matched-y" })
      .all();
    expect(result).toEqual(["matched-x", "matched-y"]);
  });

  it("is non-destructive — can be called multiple times with the same result", () => {
    const builder = match({ x: true }).when(({ x }) => x, "hit");
    expect(builder.all()).toEqual(["hit"]);
    expect(builder.all()).toEqual(["hit"]);
  });
});

// ---------------------------------------------------------------------------
// .first()
// ---------------------------------------------------------------------------

describe(".first()", () => {
  it("returns null when nothing matches", () => {
    expect(
      match({ x: false })
        .when(({ x }) => x, "hit")
        .first(),
    ).toBeNull();
  });

  it("returns only the first matched result", () => {
    const result = match({ a: true, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .first();
    expect(result).toBe("A");
  });

  it("skips non-matching matchers before finding the first match", () => {
    const result = match({ a: false, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .first();
    expect(result).toBe("B");
  });

  it("works with a single matcher", () => {
    expect(match({ x: "ok" }).when("x", { ok: "found" }).first()).toBe("found");
  });
});

// ---------------------------------------------------------------------------
// .last()
// ---------------------------------------------------------------------------

describe(".last()", () => {
  it("returns null when nothing matches", () => {
    expect(
      match({ x: false })
        .when(({ x }) => x, "hit")
        .last(),
    ).toBeNull();
  });

  it("returns only the last matched result", () => {
    const result = match({ a: true, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .last();
    expect(result).toBe("B");
  });

  it("skips matchers after the last match", () => {
    const result = match({ a: true, b: false })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .last();
    expect(result).toBe("A");
  });

  it("with a single match, first and last return the same value", () => {
    const builder = match({ x: "sm" }).when("x", { sm: "text-sm" });
    expect(builder.first()).toBe(builder.last());
  });
});

// ---------------------------------------------------------------------------
// .resolve()
// ---------------------------------------------------------------------------

describe(".resolve()", () => {
  it("returns an empty string when nothing matches and TOut is string", () => {
    const result = match({ x: false })
      .when(({ x }) => x, "hit")
      .resolve();
    expect(result).toBe("");
  });

  it("joins all string results with a space", () => {
    const result = match({ a: true, b: true })
      .when(({ a }) => a, "font-bold")
      .when(({ b }) => b, "italic")
      .resolve();
    expect(result).toBe("font-bold italic");
  });

  it("returns a single match without extra spaces", () => {
    const result = match({ variant: "primary" })
      .when("variant", { primary: "bg-indigo-600 text-white" })
      .resolve();
    expect(result).toBe("bg-indigo-600 text-white");
  });

  it("does not add leading or trailing spaces", () => {
    const result = match({ a: false, b: true, c: false })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .when(({ c }) => c, "C")
      .resolve();
    expect(result).toBe("B");
    expect(result.startsWith(" ")).toBe(false);
    expect(result.endsWith(" ")).toBe(false);
  });

  it("returns an array when TOut is not string", () => {
    const result = match<{ x: boolean }, number>({ x: true })
      .when(({ x }) => x, 42)
      .resolve();
    expect(result).toEqual([42]);
  });

  it("is non-destructive — can be called multiple times with the same result", () => {
    const builder = match({ a: true, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B");
    expect(builder.resolve()).toBe("A B");
    expect(builder.resolve()).toBe("A B");
  });
});

// ---------------------------------------------------------------------------
// Result functions
// ---------------------------------------------------------------------------

describe("result functions", () => {
  it("predicate form — result function receives the full input value", () => {
    const result = match<{ multiplier: number; base: number }, number>({ multiplier: 3, base: 10 })
      .when(
        ({ multiplier }) => multiplier > 1,
        ({ multiplier, base }) => multiplier * base,
      )
      .first();
    expect(result).toBe(30);
  });

  it("key switch form — result function receives the full input value", () => {
    const result = match<{ size: "sm" | "lg"; scale: number }>({ size: "lg", scale: 4 })
      .when("size", {
        sm: ({ scale }) => `gap-${scale / 2}`,
        lg: ({ scale }) => `gap-${scale * 2}`,
      })
      .first();
    expect(result).toBe("gap-8");
  });

  it("result functions and static results can be mixed in one key switch", () => {
    const result = match({ variant: "dynamic" as string, value: 99 })
      .when("variant", {
        static: "hardcoded-class",
        dynamic: ({ value }) => `opacity-${value}`,
      })
      .first();
    expect(result).toBe("opacity-99");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("no matchers registered — all() returns empty array", () => {
    expect(match({ x: 1 }).all()).toEqual([]);
  });

  it("no matchers registered — first() returns null", () => {
    expect(match({ x: 1 }).first()).toBeNull();
  });

  it("no matchers registered — last() returns null", () => {
    expect(match({ x: 1 }).last()).toBeNull();
  });

  it("no matchers registered — resolve() returns empty string", () => {
    expect(match({ x: 1 }).resolve()).toBe("");
  });

  it("handles boolean values via predicate form", () => {
    expect(
      match({ active: false })
        .when(({ active }) => active, "ring-2")
        .when(({ active }) => !active, "opacity-50")
        .first(),
    ).toBe("opacity-50");

    expect(
      match({ active: true })
        .when(({ active }) => active, "ring-2")
        .when(({ active }) => !active, "opacity-50")
        .first(),
    ).toBe("ring-2");
  });

  it("handles numeric key cases", () => {
    const result = match({ level: 3 as number })
      .when("level", { 1: "text-sm", 2: "text-base", 3: "text-lg" })
      .first();
    expect(result).toBe("text-lg");
  });

  it("multiple when calls on the same key each fire independently", () => {
    const result = match({ variant: "a" })
      .when("variant", { a: "first-a" })
      .when("variant", { a: "second-a" })
      .all();
    expect(result).toEqual(["first-a", "second-a"]);
  });

  it("works with deeply nested object values as input", () => {
    const result = match({ user: { role: "admin" }, active: true })
      .when(({ user }) => user.role === "admin", "bg-red-100")
      .when(({ active }) => active, "ring-2")
      .resolve();
    expect(result).toBe("bg-red-100 ring-2");
  });
});

// ---------------------------------------------------------------------------
// when()
// ---------------------------------------------------------------------------

describe("when()", () => {
  // --- true branch ---

  it("returns the true branch value when condition is true", () => {
    expect(when(true, () => "visible")).toBe("visible");
  });

  it("returns null when condition is false and no false branch is provided", () => {
    expect(when(false, () => "visible")).toBeNull();
  });

  it("is lazy — true thunk is not called when condition is false", () => {
    let called = false;
    when(false, (_v) => {
      called = true;
      return "x";
    });
    expect(called).toBe(false);
  });

  it("is lazy — true thunk is called when condition is true", () => {
    let called = false;
    when(true, (_v) => {
      called = true;
      return "x";
    });
    expect(called).toBe(true);
  });

  // --- false branch overload ---

  it("returns the false branch value when condition is false and false branch is provided", () => {
    expect(
      when(
        false,
        () => "yes",
        () => "no",
      ),
    ).toBe("no");
  });

  it("returns the true branch value when condition is true and false branch is provided", () => {
    expect(
      when(
        true,
        () => "yes",
        () => "no",
      ),
    ).toBe("yes");
  });

  it("is lazy — false thunk is not called when condition is true", () => {
    let called = false;
    when(
      true,
      () => "x",
      (_v) => {
        called = true;
        return "y";
      },
    );
    expect(called).toBe(false);
  });

  it("is lazy — false thunk is called when condition is false", () => {
    let called = false;
    when(
      false,
      () => "x",
      (_v) => {
        called = true;
        return "y";
      },
    );
    expect(called).toBe(true);
  });

  // --- value passed to callback ---

  it("passes the condition value into the true branch callback", () => {
    const received: boolean[] = [];
    when(true, (v) => {
      received.push(v);
      return "x";
    });
    expect(received).toEqual([true]);
  });

  it("passes the condition value into the false branch callback", () => {
    const received: boolean[] = [];
    when(
      false,
      () => "x",
      (v) => {
        received.push(v);
        return "y";
      },
    );
    expect(received).toEqual([false]);
  });

  it("accepts nullable and optional values with truthy semantics", () => {
    const received: string[] = [];
    expect(
      when("hello", (result) => {
        received.push(result);
        return result;
      }),
    ).toBe("hello");
    expect(received).toEqual(["hello"]);
    expect(when(null as string | null, () => "x")).toBeNull();
    expect(when(undefined as string | undefined, () => "x")).toBeNull();
    expect(when("", () => "x")).toBeNull();
    expect(when(0, () => "x")).toBeNull();
  });

  it("passes falsy condition values into the false branch callback", () => {
    expect(
      when(
        null as string | null,
        () => "yes",
        (value) => value,
      ),
    ).toBeNull();
    expect(
      when(
        "",
        () => "yes",
        (value) => value,
      ),
    ).toBe("");
  });

  // --- JSX / templating use-cases ---

  it("works with non-string return types (e.g. numbers)", () => {
    expect(when(true, () => 42)).toBe(42);
    expect(when(false, () => 42)).toBeNull();
  });

  it("works with object return types", () => {
    const obj = { tag: "span" };
    expect(when(true, () => obj)).toBe(obj);
    expect(when(false, () => obj)).toBeNull();
  });

  it("false branch may return a different type than true branch", () => {
    const result = when(
      false,
      () => "active",
      () => 0,
    );
    expect(result).toBe(0);
  });

  it("null is returned (not false) on no-match — safe for JSX interpolation", () => {
    const result = when(false, () => "badge");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// collect()
// ---------------------------------------------------------------------------

describe("collect()", () => {
  // --- basic behaviour ---

  it("joins multiple strings with a space", () => {
    expect(collect("a", "b", "c")).toBe("a b c");
  });

  it("returns an empty string when called with no arguments", () => {
    expect(collect()).toBe("");
  });

  it("returns an empty string when all values are falsy", () => {
    expect(collect(null, undefined, false, "")).toBe("");
  });

  it("filters out null", () => {
    expect(collect("a", null, "b")).toBe("a b");
  });

  it("filters out undefined", () => {
    expect(collect("a", undefined, "b")).toBe("a b");
  });

  it("filters out false", () => {
    expect(collect("a", false, "b")).toBe("a b");
  });

  it("filters out empty strings", () => {
    expect(collect("a", "", "b")).toBe("a b");
  });

  it("filters out mixed falsy values in one call", () => {
    expect(collect(null, "a", false, undefined, "b", "", "c")).toBe("a b c");
  });

  it("returns the single truthy value as-is without extra spaces", () => {
    expect(collect(null, "only", null)).toBe("only");
  });

  it("does not add leading or trailing spaces", () => {
    const result = collect(null, "a", null);
    expect(result.startsWith(" ")).toBe(false);
    expect(result.endsWith(" ")).toBe(false);
  });

  it("preserves internal spaces within individual values", () => {
    expect(collect("px-2 py-1", "font-bold")).toBe("px-2 py-1 font-bold");
  });

  // collect() --- composed with when() ---

  it("collects results from multiple when() calls", () => {
    const result = collect(
      when(true, () => "ring-2"),
      when(false, () => "opacity-50"),
      when(true, () => "font-bold"),
    );
    expect(result).toBe("ring-2 font-bold");
  });

  it("returns empty string when all when() calls return null", () => {
    const result = collect(
      when(false, () => "a"),
      when(false, () => "b"),
    );
    expect(result).toBe("");
  });

  it("works with when() two-arg and three-arg forms mixed", () => {
    const result = collect(
      when(true, () => "text-white"),
      when(
        false,
        () => "hidden",
        () => "visible",
      ),
    );
    expect(result).toBe("text-white visible");
  });

  // collect() — composed with match() ---

  it("collects results from match().resolve() and when()", () => {
    const props = { variant: "primary" as "primary" | "secondary", disabled: true };
    const result = collect(
      match(props)
        .when("variant", { primary: "bg-indigo-600 text-white", secondary: "bg-slate-200" })
        .resolve(),
      when(props.disabled, () => "opacity-50 cursor-not-allowed"),
    );
    expect(result).toBe("bg-indigo-600 text-white opacity-50 cursor-not-allowed");
  });

  it("collects results from match().first() and when()", () => {
    const props = { size: "lg" as "sm" | "md" | "lg", active: true };
    const result = collect(
      match(props).when("size", { sm: "text-sm", md: "text-base", lg: "text-lg" }).first(),
      when(props.active, () => "ring-2 ring-indigo-500"),
    );
    expect(result).toBe("text-lg ring-2 ring-indigo-500");
  });

  it("handles match().resolve() returning empty string gracefully", () => {
    const result = collect(
      match({ variant: "ghost" as string })
        .when("variant", { primary: "bg-indigo-600" })
        .resolve(),
      when(true, () => "font-bold"),
    );
    expect(result).toBe("font-bold");
  });

  // --- full real-world example ---

  it("full real-world example — button class composition", () => {
    const props: {
      variant: "primary" | "secondary";
      size: "sm" | "md" | "lg";
      disabled: boolean;
      active: boolean;
    } = { variant: "primary", size: "lg", disabled: true, active: false };

    const classes = collect(
      match(props)
        .when("variant", {
          primary: "bg-indigo-600 text-white",
          secondary: "bg-slate-200 text-slate-900",
        })
        .when("size", {
          sm: "px-2 py-1 text-sm",
          md: "px-4 py-2 text-base",
          lg: "px-6 py-3 text-lg",
        })
        .resolve(),
      when(props.disabled, () => "opacity-50 cursor-not-allowed"),
      when(props.active, () => "ring-2 ring-offset-2 ring-indigo-500"),
    );

    expect(classes).toBe(
      "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed",
    );
  });
});

// ---------------------------------------------------------------------------
// each()
// ---------------------------------------------------------------------------

describe("each()", () => {
  it("returns a builder with as", () => {
    const builder = each([1]);
    expect(typeof builder.as).toBe("function");
  });

  it(".as() returns a mapped array with optional else", () => {
    const result = each([1]).as((n) => n);
    expect(Array.isArray(result)).toBe(true);
    expect([...result]).toEqual([1]);
    expect(typeof result.else).toBe("function");
  });
});

describe("each() .as()", () => {
  it("maps each item", () => {
    expect([...each([1, 2, 3]).as((n) => n * 2)]).toEqual([2, 4, 6]);
  });

  it("passes index to the map function", () => {
    expect([...each(["a", "b", "c"]).as((_, i) => i)]).toEqual([0, 1, 2]);
  });

  it("returns an empty array when the collection is empty", () => {
    expect([...each([] as number[]).as((n) => n * 2)]).toEqual([]);
  });

  it("does not call the map function when the collection is empty", () => {
    let called = false;
    each([] as number[]).as(() => {
      called = true;
      return 0;
    });
    expect(called).toBe(false);
  });
});

describe("each() .as() .else()", () => {
  it("maps each item when the collection is non-empty", () => {
    expect(
      each([1, 2, 3])
        .as((n) => `item-${n}`)
        .else(() => "empty"),
    ).toEqual(["item-1", "item-2", "item-3"]);
  });

  it("returns the else branch when the collection is empty", () => {
    expect(
      each([] as number[])
        .as((n) => `item-${n}`)
        .else(() => "empty"),
    ).toEqual(["empty"]);
  });

  it("accepts a static else value", () => {
    expect(
      each([] as number[])
        .as((n) => `item-${n}`)
        .else("empty"),
    ).toEqual(["empty"]);
  });

  it("returns mapped items when collection is non-empty (static else)", () => {
    expect(
      each([1, 2])
        .as((n) => n * 2)
        .else("empty"),
    ).toEqual([2, 4]);
  });

  it("passes the empty collection to the else callback", () => {
    const received: number[][] = [];
    each([] as number[])
      .as((n) => n)
      .else((items) => {
        received.push([...items]);
        return "fallback";
      });
    expect(received).toEqual([[]]);
  });

  it("is lazy — else is not called when items exist", () => {
    let elseCalled = false;
    each([1])
      .as((n) => n)
      .else(() => {
        elseCalled = true;
        return "empty";
      });
    expect(elseCalled).toBe(false);
  });

  it("is lazy — map is not called when the collection is empty", () => {
    let mapCalled = false;
    each([] as number[])
      .as(() => {
        mapCalled = true;
        return 0;
      })
      .else(() => "empty");
    expect(mapCalled).toBe(false);
  });

  it("else may return a different type than mapped items", () => {
    const result = each([] as number[])
      .as((n) => n)
      .else(() => ({ kind: "empty" as const }));
    expect(result as unknown).toEqual([{ kind: "empty" }]);
  });

  it("works with object return types from map", () => {
    const result = each([1, 2])
      .as((n) => ({ id: n }))
      .else(() => null);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("keeps null and false else values unwrapped", () => {
    expect(
      each([] as number[])
        .as((n) => n)
        .else(() => null),
    ).toBe(null);
    expect(
      each([] as number[])
        .as((n) => n)
        .else(false),
    ).toBe(false);
  });

  it("wraps static renderable else values in an array", () => {
    const emptyNode = { value: "<p>No todos.</p>" };
    expect(
      each([] as number[])
        .as((n) => n)
        .else(emptyNode) as unknown,
    ).toEqual([emptyNode]);
  });

  it("throws when given a function instead of an array", () => {
    expect(() => each((() => []) as unknown as number[])).toThrow(
      /expected an array but received a function/,
    );
  });
});

describe("each() .key()", () => {
  it("returns a keyed builder with as", () => {
    const keyed = each([1]).key((n) => n);
    expect(typeof keyed.as).toBe("function");
  });

  it("passes the key as the third argument to as", () => {
    const keys: number[] = [];
    each([10, 20])
      .key((n) => n)
      .as((item, index, key) => {
        keys.push(key);
        return `${item}@${index}`;
      });
    expect(keys).toEqual([10, 20]);
  });

  it("works with else for empty collections", () => {
    expect(
      each([] as { id: string }[])
        .key((item) => item.id)
        .as((item, _i, id) => `row:${id}:${item.id}`)
        .else(() => "empty"),
    ).toEqual(["empty"]);
  });

  it("does not call key or map when the collection is empty", () => {
    let keyCalled = false;
    let mapCalled = false;
    each([] as number[])
      .key(() => {
        keyCalled = true;
        return 0;
      })
      .as(() => {
        mapCalled = true;
        return 0;
      })
      .else(() => "empty");
    expect(keyCalled).toBe(false);
    expect(mapCalled).toBe(false);
  });

  it("simulates ilha island.key() usage", () => {
    type Item = { id: string; label: string };
    const Item = {
      key: (id: string) => (props: { item: Item }) => ({ id, props }),
    };
    const items: Item[] = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ];

    const result = each(items)
      .key((item) => item.id)
      .as((item, _i, id) => Item.key(id)({ item }));

    expect([...result]).toEqual([
      { id: "a", props: { item: { id: "a", label: "Alpha" } } },
      { id: "b", props: { item: { id: "b", label: "Beta" } } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// resource()
// ---------------------------------------------------------------------------

describe("resource()", () => {
  it("returns a builder with loading, error, and ready", () => {
    const builder = resource({ loading: false, value: 1, error: undefined });
    expect(typeof builder.loading).toBe("function");
    expect(typeof builder.error).toBe("function");
    expect(typeof builder.ready).toBe("function");
  });
});

describe("resource() .loading() .error() .ready()", () => {
  it("returns the loading branch when loading", () => {
    const result = resource<number>({ loading: true, value: undefined, error: undefined })
      .loading(() => "loading")
      .error(() => "error")
      .ready(() => "ready");
    expect(result).toBe("loading");
  });

  it("returns the error branch when not loading and error is set", () => {
    const err = new Error("fail");
    const result = resource<number>({ loading: false, value: undefined, error: err })
      .loading(() => "loading")
      .error((e) => e.message)
      .ready(() => "ready");
    expect(result).toBe("fail");
  });

  it("returns the ready branch with the envelope value", () => {
    const result = resource({ loading: false, value: [1, 2], error: undefined })
      .loading(() => "loading")
      .error(() => "error")
      .ready((value) => value!.map(String));
    expect(result).toEqual(["1", "2"]);
  });

  it("prefers loading over error when both are set", () => {
    const result = resource<number>({
      loading: true,
      value: undefined,
      error: new Error("fail"),
    })
      .loading(() => "loading")
      .error(() => "error")
      .ready(() => "ready");
    expect(result).toBe("loading");
  });

  it("is lazy — only the taken branch runs", () => {
    let loadingCalled = false;
    let errorCalled = false;
    let readyCalled = false;

    resource({ loading: false, value: 42, error: undefined })
      .loading(() => {
        loadingCalled = true;
        return "loading";
      })
      .error(() => {
        errorCalled = true;
        return "error";
      })
      .ready(() => {
        readyCalled = true;
        return "ready";
      });

    expect(loadingCalled).toBe(false);
    expect(errorCalled).toBe(false);
    expect(readyCalled).toBe(true);
  });
});

describe("resource() .error() .ready()", () => {
  it("skips loading and uses error or ready", () => {
    expect(
      resource({ loading: true, value: undefined, error: undefined })
        .error(() => "error")
        .ready(() => "ready"),
    ).toBe("ready");

    expect(
      resource<number>({
        loading: false,
        value: undefined,
        error: new Error("x"),
      })
        .error((e) => e.message)
        .ready(() => "ready"),
    ).toBe("x");
  });
});

describe("resource() .ready()", () => {
  it("calls ready directly when not loading and no error", () => {
    expect(resource({ loading: false, value: "ok", error: undefined }).ready((v) => v)).toBe("ok");
  });
});
