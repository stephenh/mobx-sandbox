import { autorun, observable, toJS } from "mobx";
import isPlainObject from 'is-plain-object';
import equal from 'fast-deep-equal';

/**
 * Wraps a given input/on-the-wire type `T` for editing in a form.
 *
 * We basically mimick every field in `T` (i.e. `firstName`, `lastName`, etc.) but decorate them
 * with form-specific state like `touched`, `dirty`, `errors`, etc.
 *
 * The intent is that, after ensuring all fields are `valid`/etc., callers can take the
 * result of this `objectState.value` (or `objectState.originalValue` for the non-proxy version) and
 * have exactly the on-the-wire type `T` that they need to submit to the backend, without doing the
 * manual mapping of "data that was in the form controls" into "data that the backend wants".
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
// TODO Maybe rename to FormObjectState or ObjectFieldState
// TODO Extend FieldState
export type ObjectState<T> = FieldStates<T> & {
  /** The current value as the given DTO/GraphQL/wire type `T`. */
  value: T;

  /** Sets the state of fields in `state`. */
  set(state: Partial<T>): void;

  /** Resets state of form fields to their original values */
  reset(): void;

  /** Resets state of form fields to their original values */
  save(): void;

  /** Whether this object and all of it's fields (i.e. recursively for list fields) are valid. */
  readonly valid: boolean;

  readonly touched: boolean;

  readonly dirty: boolean;

  /** The original object passed to `set`, note this is not observable. */
  readonly originalInstance: T;
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
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly valid: boolean;
  rules: Rule<T, V>[];
  readonly errors: string[];
  blur(): void;
  set(value: V): void;
  reset(): void;
  save(): void;
}

/** Form state for list of children, i.e. `U` is a `Book` in a form with a `books: Book[]`. */
interface ListFieldState<T, U> extends FieldState<T, U[]> {
  readonly rows: ReadonlyArray<ObjectState<U>>;
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
  return newObjectState(config);
}

function newObjectState<T>(config: ObjectConfig<T>, existingProxy?: T): ObjectState<T> {
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
    value: existingProxy || {},

    initialized: false,

    get touched(): boolean {
      return fieldNames.map((name) => (this as any)[name]).some((f) => f.touched);
    },

    get valid(): boolean {
      return fieldNames.map((name) => (this as any)[name]).every((f) => f.valid);
    },

    get dirty(): boolean {
      return fieldNames.map((name) => (this as any)[name]).some((f) => f.dirty);
    },

    // Accepts new values in bulk, i.e. when setting the form initial state from the backend.
    set(value) {
      if (!(this as any).initialized) {
        // TODO Need to figure out a way to force a one-time non-Partial initialization
        // On the 1st set call, _value will be our non-proxy original instance
        _value = value as T;
        // Note that we skip the expected `this.value = value` assignment this will immediately
        // deep proxy-ize everything in `value` and we want our `fieldName.set` calls to see
        // the original values
        (this as any).initialized = true;
      }
      fieldNames.forEach((name) => {
        if (name in value) {
          (this as any)[name].set((value as any)[name]);
        }
      });
    },

    // Resets all fields back to their original values
    reset() {
      fieldNames.forEach((name) => {
        (this as any)[name].reset();
      });
    },

    // Saves all current values into _originalValue
    save() {
      fieldNames.forEach((name) => {
        (this as any)[name].save();
      });
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

  // Push the parent observable into each child FieldState. For the child FieldStates to be able
  // to use this and trigger reactivity, we have to do this after calling `observable`.
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
      return (this as any).parent.value?.[key];
    },

    set value(v: V) {
      this.set(v);
    },

    get dirty(): boolean {
      if (isPlainObject(_originalValue)) {
        return !equal(_originalValue, toJS(this.value));
      }
      return this.value !== _originalValue;
    },

    get valid(): boolean {
      return this.rules.every((r) => r(this.value, key, (this as any).parent) === undefined);
    },

    get errors(): string[] {
      return this.rules.map((r) => r(this.value, key, (this as any).parent)).filter(isNotUndefined);
    },

    blur() {
      // touched is readonly, but we're allowed to change it
      (this as any).touched = true;
    },

    set(value: V | null | undefined) {
      if (!initialized) {
        _originalValue = value;
        initialized = true;
      }
      // Set the value on our parent proxy object
      (this as any).parent.value[key] = value;
      // And also mirror it into our original object identity
      (this as any).parent.originalInstance[key] = value;
    },

    reset() {
      this.set(_originalValue);
    },

    save() {
      if (isPlainObject(_originalValue)) {
        _originalValue = toJS(this.value);
      } else {
        _originalValue = this.value;
      }
    }
  } as FieldState<T, V | null | undefined>;
}

function newListFieldState<T, U>(key: string, rules: Rule<T, U[]>[], config: ObjectConfig<U>): ListFieldState<T, U> {
  // Keep a map of "item in the parent list" -> "that item's ObjectState"
  const proxyRowMap = new Map<U, ObjectState<U>>();
  const nonProxyRowMap = new Map<U, ObjectState<U>>();
  let initialized = false;

  // this is for dirty checking, not object identity
  let originalCopy = undefined as U[] | undefined;

  return {
    key,

    // Our fundamental state of wrapped Us
    get value() {
      return (this as any).parent.value[key];
    },

    set value(v: U[]) {
      this.set(v);
    },

    get dirty(): boolean {
      if (this.rows.some((r) => r.dirty)) {
        return true;
      }
      if (!initialized) {
        return false;
      }
      const currentList = (this as any).parent.originalInstance[key];
      const a = (currentList || []).every((e: any) => (originalCopy || []).includes(e));
      const b = (originalCopy || []).every((e: any) => (currentList || []).includes(e));
      const isSame = a && b;
      return !isSame;
    },

    // And we can derive each value's ObjectState wrapper as needed from the rowMap cache
    get rows(): ObjectState<U>[] {
      return (this.value || []).map((child) => {
        // Because we're reading from this.value, child will be the proxy version
        let childState = proxyRowMap.get(child);
        if (!childState) {
          childState = newObjectState<U>(config, child);
          childState.set(child);
          proxyRowMap.set(child, childState);
        }
        return childState;
      });
    },

    // TODO Should this be true when all rows are touched?
    get touched() {
      return this.rows.some((r) => r.touched);
    },

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

    blur() {
      // TODO Set touched on all rows
    },

    set(values: U[]) {
      if (!initialized) {
        // On initialize, we should be passed a list of non-proxy children, which we're going to use for our
        // "does the new/old list have the same object identity" for dirty checking, so keep a copy of these.
        originalCopy = [...values];
        initialized = true;
      }
      // We should be passed values that are non-proxies.
      (this as any).parent.value[key] = values.map((value) => {
        // value might be either a proxy (depending on how the user called it) or the non-proxy value (if initializing)
        let childState = proxyRowMap.get(value) || nonProxyRowMap.get(value);
        if (!childState) {
          childState = createObjectState(config);
          // This should be giving our child the original non-proxy value
          childState.set(value);
          // Keep a look up of non-proxy value in case the user calls the `set` method again with the non-proxy value
          nonProxyRowMap.set(value, childState);
          proxyRowMap.set(childState.value, childState);
        }
        // Return the already-observable'd value so that our `parent.value[key] = values` doesn't re-proxy things
        return childState.value;
      });
    },

    add(value: U): void {
      // This is called by the user, so value should be a non-proxy value we should keep
      const childState = createObjectState(config);
      childState.set(value);
      nonProxyRowMap.set(value, childState);
      proxyRowMap.set(childState.value, childState);
      this.value.push(childState.value);
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

    reset() {
      if (originalCopy) {
        this.set(originalCopy);
        this.rows.every((r) => r.reset());
      }
    },

    save() {
      this.rows.every((r) => {
        r.save();
        nonProxyRowMap.set(r.originalInstance, r);
      });
      originalCopy = (this as any).parent.originalInstance[key];
    },

    // Every time our value changes, update the original/non-proxy list
    autorun() {
      // Read rows before returning so we're reactive
      const rows = this.rows;
      if (!initialized) {
        return;
      }
      // We could do a smarter diff, but just clear and re-add everything for now
      const originalList = (this as any).parent.originalInstance[key] as Array<any>;
      originalList.splice(0, originalList.length);
      originalList.push(...rows.map((row) => row.originalInstance));
    },
  } as ListFieldState<T, U>;
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
