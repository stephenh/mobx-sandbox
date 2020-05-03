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
export type ObjectState<T> = FieldStates<T> & {
  valid: boolean;
  value: T;
  set(state: Partial<T>): void;
};

type FieldStates<T> = { [P in keyof T]-?: T[P] extends Array<infer U> ? ListFieldState<U> : FieldState<T[P]> };

/** A validation rule, given the value and name, return the error string if valid, or undefined if valid. */
export type Rule<T> = (value: T, name: string) => string | undefined;

/** A rule that validates `value` is not `undefined`, `null`, or empty string. */
export const required: Rule<any> = (v: any) => (v !== undefined && v !== null && v !== "" ? undefined : "Required");

/**
 * The current state of a field in the form, i.e. it's value but also touched/validation/etc. state.
 *
 * This API also provides hooks for form elements to call into, i.e. `blur()` and `set(...)` that will
 * update the field state and re-render, i.e. when including in an `ObjectState`-typed literal that is
 * an mbox `useLocalStore`/observable.
 */
// TODO: How should T handle null | undefined?
export interface FieldState<T> {
  readonly key: string;
  value: T;
  touched: boolean;
  valid: boolean;
  rules: Rule<T>[];
  errors: string[];
  blur(): void;
  set(value: T): void;
}

/** Form state for list of children, i.e. `U` is a `Book` in a form with a `books: Book[]`. */
interface ListFieldState<U> extends FieldState<U[]> {
  rows: Array<ObjectState<U>>;
  add(value: U): void;
  remove(value: U): void;
}

/** Config rules for each field in `T` that we're editing in a form. */
type ObjectConfig<T> = {
  [P in keyof T]: T[P] extends Array<infer U> ? ListFieldConfig<U> : TextFieldConfig;
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
    if (config.type === "string") {
      // TODO Fix as any
      return [key, newTextFieldState(key as string, (config as any).rules || [])];
    } else if (config.type === "list") {
      // TODO Fix as any
      return [key, newListFieldState(key as string, (config as any).rules || [], (config as any).config)];
    } else {
      throw new Error("Unsupported");
    }
  });
  const fieldNames = Object.keys(config);
  return {
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
}

type TextFieldConfig = { type: "string"; rules?: Rule<string | null | undefined>[] };

function newTextFieldState(
  key: string,
  rules: Rule<string | null | undefined>[],
): FieldState<string | null | undefined> {
  return {
    key,
    value: "",
    touched: false,
    rules,
    get valid(): boolean {
      return this.rules.every((r) => r(this.value, key) === undefined);
    },
    get errors(): string[] {
      return this.rules.map((r) => r(this.value, key)).filter(isNotUndefined);
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
type ListFieldConfig<U> = {
  type: "list";
  /** Rules that can run on the full list of children. */
  rules?: Rule<U[]>[];
  /** Config for each child's form state, i.e. each book. */
  config: ObjectConfig<U>;
};

function newListFieldState<U>(key: string, rules: Rule<U>[], config: ObjectConfig<U>): ListFieldState<U> {
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

    // TODO Fix this as any
    rules: rules as any,

    get valid(): boolean {
      const value = this.value;
      const collectionValid = this.rules.every((r) => r(value, key) === undefined);
      const entriesValid = this.rows.every((r) => r.valid);
      return collectionValid && entriesValid;
    },

    get errors(): string[] {
      return this.rules.map((r) => r(this.value, "firstName")).filter(isNotUndefined);
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
