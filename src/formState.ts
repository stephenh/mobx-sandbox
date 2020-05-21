import { autorun, observable } from "mobx";

/**
 * Wraps a given input/on-the-wire type `T` for editing in a form.
 *
 * We basically mimick every field in `T` (i.e. `firstName`, `lastName`, etc.) but decorate them
 * with form-specific state like `touched`, `dirty`, `errors`, etc.
 *
 * The intent is that, after ensuring all fields are `valid`/etc., callers can take the
 * result of this `objectState.value` and have exactly the on-the-wire type `T` that they
 * need to submit to the backend, without doing the manual mapping of "data that was in the
 * form controls" into "data that the backend wants".
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
// TODO Maybe rename to FormObjectState
export type ObjectState<T> = FieldStates<T> & {
  /** Whether this object and all of it's fields (i.e. recursively for list fields) are valid. */
  valid: boolean;

  /** The current value as the given DTO/GraphQL/wire type `T`. */
  value: T;

  /** Sets the state of fields in `state`. */
  set(state: Partial<T>): void;

  /** The original object passed to `set`, note this is not observable. */
  originalInstance: T;
};

/** For a given input type `T`, decorate each field into the "field state" type that holds our form-relevant state, i.e. valid/touched/etc. */
type FieldStates<T> = {
  [P in keyof T]-?: T[P] extends Array<infer U> | null | undefined ? ListFieldState<T, U> : FieldState<T, T[P]>;
};

/** A validation rule, given the value and name, return the error string if valid, or undefined if valid. */
export type Rule<T, V> = (value: V, key: string, object: ObjectState<T>) => string | undefined;

/** A rule that validates `value` is not `undefined`, `null`, or empty string. */
export function required<T, V>(v: V): string | undefined {
  return v !== undefined && v !== null && (v as any) !== "" ? undefined : "Required";
}

/**
 * Form state for a primitive field in the form, i.e. its value but also touched/validation/etc. state.
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
  dirty: boolean;
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
  remove(indexOrValue: number | U): void;
}

/**
 * Config rules for each field in `T` that we're editing in a form.
 *
 * Basically every field is either a value/primitive or a list, and this `ObjectConfig` lets
 * the caller define field-specific behavior, i.e. validation rules.
 */
type ObjectConfig<T> = {
  [P in keyof T]: T[P] extends Array<infer U> | null | undefined ? ListFieldConfig<T, U> : ValueFieldConfig<T, T[P]>;
};

/** Field configuration for primitive values, i.e. strings/numbers/Dates/user-defined types. */
type ValueFieldConfig<T, V> = {
  type: "value";
  rules?: Rule<T, V | null | undefined>[];
};

/** Field configuration for list values, i.e. `U` is `Book` in a form with `books: Book[]`. */
type ListFieldConfig<T, U> = {
  type: "list";
  /** Rules that can run on the full list of children. */
  rules?: Rule<T, U[]>[];
  /** Config for each child's form state, i.e. each book. */
  config: ObjectConfig<U>;
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

  // Store a reference to the persistent identity of the object we're editing
  let _value: T | undefined = undefined;

  const obj = {
    ...Object.fromEntries(fieldStates),

    // This value will become a mobx proxy of our object which mobx needs for reactivity.
    // We separately keep the a non-proxy _value reference to the original object.
    value: {},

    initialized: false,

    get valid(): boolean {
      return fieldNames.map((name) => (this as any)[name]).every((f) => f.valid);
    },

    // Accepts new values in bulk, i.e. when setting the form initial state from the backend.
    set(value) {
      if (!(this as any).initialized) {
        // TODO Need to figure out a way to force a one-time non-Partial initialization
        _value = value as T;
        this.value = value as T;
        (this as any).initialized = true;
      } else {
        fieldNames.forEach((name) => {
          if (name in value) {
            (this as any)[name].set((value as any)[name]);
          }
        });
      }
    },

    // private
    get originalInstance() {
      if (!(this as any).initialized) {
        throw new Error("set has not been called");
      }
      return _value!;
    },

    // private
    get isInitialized() {
      return (this as any).initialized;
    },
  } as ObjectState<T>;
  // Push the parent pointer into each field
  const o = observable(obj);
  fieldNames.forEach((key) => {
    (o as any)[key].parent = o;
    // Let ListFieldStates auto-sync the proxy value back into original
    if ("autorun" in (o as any)[key]) {
      autorun(() => (o as any)[key]["autorun"]());
    }
  });
  return o;
}

function newValueFieldState<T, V>(
  key: string,
  rules: Rule<T, V | null | undefined>[],
): FieldState<T, V | null | undefined> {
  let initialized = false;
  let _originalValue = undefined as V | null | undefined;
  return {
    key,

    touched: false,

    rules,

    get value(): V {
      const value = (this as any).parent.value?.[key];
      if ((this as any).parent.isInitialized && !initialized) {
        _originalValue = value;
        initialized = true;
      }
      return value;
    },

    set value(v: V) {
      this.set(v);
    },

    get dirty(): boolean {
      return this.value !== _originalValue;
    },

    get valid(): boolean {
      return this.rules.every((r) => r(this.value, key, (this as any).parent) === undefined);
    },

    get errors(): string[] {
      return this.rules.map((r) => r(this.value, key, (this as any).parent)).filter(isNotUndefined);
    },

    blur() {
      this.touched = true;
    },

    set(v: V | null | undefined) {
      // Set the value on our parent proxy object
      (this as any).parent.value[key] = v;
      // And also mirror it into our original object identity
      (this as any).parent.originalInstance[key] = v;
    },
  } as FieldState<T, V | null | undefined>;
}

function newListFieldState<T, U>(key: string, rules: Rule<T, U[]>[], config: ObjectConfig<U>): ListFieldState<T, U> {
  // Keep a map of "item in the parent list" -> "that item's ObjectState"
  const rowMap = new Map<U, ObjectState<U>>();

  return {
    key,

    // Our fundamental state of wrapped Us
    get value() {
      // Use our parent proxy's copy of the object (itself a proxy)
      return (this as any).parent.value[key];
    },

    set value(v: U[]) {
      this.set(v);
    },

    // And we can derive each value's ObjectState wrapper as needed from the rowMap cache
    get rows(): ObjectState<U>[] {
      // Could this just be rowMap.values?
      return (this.value || []).map((child) => {
        let childState = rowMap.get(child);
        if (!childState) {
          childState = createObjectState<U>(config);
          childState.set(child);
        }
        return childState;
      });
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
      (this as any).parent.value[key] = values;
    },

    add(value: U): void {
      this.value.push(value);
    },

    remove(indexOrValue: number | U): void {
      if (typeof indexOrValue === "number") {
        this.value.splice(indexOrValue, 1);
      } else {
        const index = this.value.findIndex((v) => v === indexOrValue);
        if (index > -1) {
          this.value.splice(index, 1);
        }
      }
    },

    // Every time our value changes, update the original/non-proxy list
    // @ts-ignore private
    autorun() {
      if (!(this as any).parent.isInitialized) {
        return;
      }
      // We could do a smarter diff, but just clear and re-add everything for now
      const originalList = (this as any).parent.originalInstance[key] as Array<any> | undefined;
      if (originalList === undefined) {
        return;
      }
      originalList.splice(0, originalList.length);
      originalList.push(...this.rows.map((row) => row.originalInstance));
    },
  };
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
