/**
 * Wraps a given input/DTO `T` for editing in a form.
 *
 * Note that this can be hierarchical by having by having a field of `ListFieldState` that
 * themselves each wrap an `ObjectState`, i.e.:
 *
 * ```
 * ObjectState for author
 *   - firstName: FieldState
 *   - lastName: FieldState
 *   - rows: ListFieldState
 *     - [0]: ObjectState for book 1
 *       - title: FieldState
 *     - [1]: ObjectState for book 2
 *       - title: FieldState
 * ```
 */
import { observable } from "mobx";

export type ObjectState<T> = FieldStates<T> & {
  /** Whether this object and all of it's fields (i.e. recursively for list fields) are valid. */
  valid: boolean;

  /** The current value as the given DTO/GraphQL/wire type `T`. */
  value: T;

  /** Sets the state of fields in `state`. */
  set(state: Partial<T>): void;
};

type FieldStates<T> = { [P in keyof T]-?: T[P] extends Array<infer U> | null | undefined ? ListFieldState<T, U> : FieldState<T, T[P]> };

/** A validation rule, given the value and name, return the error string if valid, or undefined if valid. */
export type Rule<T, V> = (value: V, key: string, object: ObjectState<T>) => string | undefined;

/** A rule that validates `value` is not `undefined`, `null`, or empty string. */
export function required<T, V>(v: V): string | undefined {
  return v !== undefined && v !== null && (v as any) !== "" ? undefined : "Required";
}

/**
 * The current state of a field in the form, i.e. it's value but also touched/validation/etc. state.
 *
 * This API also provides hooks for form elements to call into, i.e. `blur()` and `set(...)` that will
 * update the field state and re-render, i.e. when including in an `ObjectState`-typed literal that is
 * an mbox `useLocalStore`/observable.
 */
// TODO: How should T handle null | undefined?
export interface FieldState<T, V> {
  readonly key: string;
  value: V;
  touched: boolean;
  valid: boolean;
  rules: Rule<T, V>[];
  errors: string[];
  blur(): void;
  set(value: V): void;
}

/** Form state for list of children, i.e. `U` is a `Book` in a form with a `books: Book[]`. */
interface ListFieldState<T, U> extends FieldState<T, U[]> {
  rows: Array<ObjectState<U>>;
  add(value: U): void;
  remove(value: U): void;
}

/**
 * Config rules for each field in `T` that we're editing in a form.
 *
 * Basically every field is either a value/primitive or a list.
 */
type ObjectConfig<T> = {
  [P in keyof T]: T[P] extends Array<infer U> | null | undefined ? ListFieldConfig<T, U> : ValueFieldConfig<T, T[P]>;
};

// See https://github.com/Microsoft/TypeScript/issues/21826#issuecomment-479851685
export const entries = Object.entries as <T>(o: T) => [keyof T, T[keyof T]][];

/**
 * Creates a new `ObjectState` for a given form object `T` given config rules in `config`.
 *
 * The returned `ObjectState` can be used in a mobx `useLocalStore` to driven an
 * interactive form that tracks the current valid/touched/etc. state of both each
 * individual fields as well as the top-level form/object itself.
 */
export function createObjectState<T>(config: ObjectConfig<T>): ObjectState<T> {
  const fieldStates = entries(config).map(([key, config]) => {
    if (config.type === "value") {
      // TODO Fix as any
      return [key, newValueFieldState(key as string, (config as any).rules || [])];
    } else if (config.type === "list") {
      // TODO Fix as any
      return [key, newListFieldState(key as string, (config as any).rules || [], (config as any).config)];
    } else {
      throw new Error("Unsupported");
    }
  });
  const fieldNames = Object.keys(config);
  const obj = {
    ...Object.fromEntries(fieldStates),

    get valid(): boolean {
      // TODO Not entirely sure why the typeof string is needed here
      return fieldNames.map((name) => (this as any)[name]).every((f) => f.valid);
    },

    // Accepts new values in bulk, i.e. when setting the form initial state from the backend.
    set(value) {
      fieldNames.forEach((name) => {
        if (name in value) {
          (this as any)[name].set((value as any)[name]);
        }
      });
    },
  } as ObjectState<T>;
  // Push the parent pointer into each field
  const o = observable(obj);
  fieldNames.forEach((key) => {
    (o as any)[key].parent = o;
  });
  return o;
}

/** Field configuration for primitive values, i.e. strings/numbers/Dates/user-defined types. */
type ValueFieldConfig<T, V> = { type: "value"; rules?: Rule<T, V | null | undefined>[] };

function newValueFieldState<T>(
  key: string,
  rules: Rule<T, string | null | undefined>[],
): FieldState<T, string | null | undefined> {
  return {
    key,
    value: undefined,
    touched: false,
    rules,
    get valid(): boolean {
      return this.rules.every((r) => r(this.value, key, (this as any).parent) === undefined);
    },
    get errors(): string[] {
      return this.rules.map((r) => r(this.value, key, (this as any).parent)).filter(isNotUndefined);
    },
    blur() {
      this.touched = true;
    },
    set(v: string) {
      this.value = v;
    },
  };
}

/** Config for a list of children, i.e. `U` is `Book` in a form with `books: Book[]`. */
type ListFieldConfig<T, U> = {
  type: "list";
  /** Rules that can run on the full list of children. */
  rules?: Rule<T, U[]>[];
  /** Config for each child's form state, i.e. each book. */
  config: ObjectConfig<U>;
};

function newListFieldState<T, U>(key: string, rules: Rule<T, U[]>[], config: ObjectConfig<U>): ListFieldState<T, U> {
  return {
    key,

    // Our fundamental state if actually the wrapped Us
    rows: [] as ObjectState<U>[],

    // And we can derive the values from the ObjectState wrappers
    get value() {
      return this.rows.map((r) => r.value);
    },

    // TODO Should this be true when all rows are touched?
    touched: false,

    rules,

    get valid(): boolean {
      const value = this.value;
      const collectionValid = this.rules.every((r) => r(value, key, (this as any).parent) === undefined);
      const entriesValid = this.rows.every((r) => r.valid);
      return collectionValid && entriesValid;
    },

    get errors(): string[] {
      return this.rules.map((r) => r(this.value, key, (this as any).parent)).filter(isNotUndefined);
    },

    // TODO Set touched on all rows
    blur() {
      this.touched = true;
    },

    set(values: U[]) {
      // TODO Should we handle values being a partial update somehow?
      this.rows = values.map((value) => {
        const state = createObjectState<U>(config);
        state.set(value);
        return state;
      });
    },

    add(value: U): void {
      const row = createObjectState<U>(config);
      row.set(value);
      this.rows = [...this.rows, row];
    },

    remove(value: U): void {
      const i = this.rows.findIndex((r) => r.value === value);
      if (i > -1) {
        this.rows.splice(i, 1);
      }
    },
  };
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
