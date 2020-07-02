import { autorun, observable, toJS } from "mobx";
import isPlainObject from "is-plain-object";
import equal from "fast-deep-equal";

/**
 * Wraps a given input/on-the-wire type `T` for editing in a form.
 *
 * We basically mimic every field in `T` (i.e. `firstName`, `lastName`, etc.) but decorate them
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

  /** Initializes the state of fields in `state`. */
  init(state: T): void;

  /** Sets the state of fields in `state`. */
  set(state: Partial<T>): void;

  /** Resets state of form fields to their original values */
  reset(): void;

  /** Resets state of form fields to their original values */
  save(): void;

  /** Whether this object and all of it's fields (i.e. recursively for list fields) are valid. */
  readonly valid: boolean;

  /** Returns whether the object can be saved, i.e. is valid, but also as a side-effect marks touched. */
  canSave(): boolean;

  touched: boolean;

  readOnly: boolean;

  readonly dirty: boolean;

  /** The original object passed to `set`, note this is not observable. */
  readonly originalValue: T;
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
 * an mobx `useLocalStore`/observable.
 */
// TODO: How should T handle null | undefined?
export interface FieldState<T, V> {
  readonly key: string;
  value: V;
  readonly originalValue: V;
  touched: boolean;
  readOnly: boolean;
  readonly dirty: boolean;
  readonly valid: boolean;
  rules: Rule<T, V>[];
  readonly errors: string[];
  /** Blur essentially touches the field. */
  blur(): void;
  init(value: V): void;
  set(value: V): void;
  reset(): void;
  save(): void;
}

/** Form state for list of children, i.e. `U` is a `Book` in a form with a `books: Book[]`. */
export interface ListFieldState<T, U> extends Omit<FieldState<T, U[]>, "originalValue"> {
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
export type ObjectConfig<T> = {
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
  let _originalValue: T | undefined = undefined;
  let _initialized = false;

  function getFields(proxyThis: any): FieldState<T, any>[] {
    return fieldNames.map(name => proxyThis[name]) as FieldState<T, any>[];
  }

  const obj = {
    ...Object.fromEntries(fieldStates),

    // This value will become a mobx proxy of our object which mobx needs for reactivity.
    // We separately keep the a non-proxy _value reference to the original object.
    value: existingProxy || {},

    // private
    _readOnly: false,
    _originalChanged: 0,

    get touched(): boolean {
      return getFields(this).some(f => f.touched);
    },

    set touched(touched: boolean) {
      getFields(this).forEach(f => (f.touched = touched));
    },

    get readOnly(): boolean {
      return this._readOnly;
    },

    set readOnly(readOnly: boolean) {
      this._readOnly = readOnly;
      getFields(this).forEach(f => (f.readOnly = readOnly));
    },

    get valid(): boolean {
      return getFields(this).every(f => f.valid);
    },

    get dirty(): boolean {
      return getFields(this).some(f => f.dirty);
    },

    canSave(): boolean {
      this.touched = true;
      return this.valid;
    },

    init(value: T) {
      // On the 1st set call, _value will be our non-proxy original instance
      this.originalValue = value as T;
      // Note that we skip the expected `this.value = value` assignment this will immediately
      // deep proxy-ize everything in `value` and we want our `fieldName.set` calls to see
      // the original values
      _initialized = true;
      this.readOnly = false;
      // Unlike set, we purposefully init every field, even if it's not present in value.
      // I.e. we may have optional fields which aren't in the input, but still need init called
      getFields(this).forEach(field => {
        field.init((value as any)[field.key]);
      });
    },

    // Accepts new values in bulk, i.e. when setting the form initial state from the backend.
    set(value: T) {
      if (!_initialized) {
        throw new Error("Not initialized");
      }
      if (this.readOnly) {
        throw new Error("Currently readOnly");
      }
      getFields(this).forEach(field => {
        if (field.key in value) {
          field.set((value as any)[field.key]);
        }
      });
    },

    // Resets all fields back to their original values
    reset() {
      getFields(this).forEach(f => f.reset());
    },

    // Saves all current values into _originalValue
    save() {
      getFields(this).forEach(f => f.save());
    },

    get originalValue(): T | undefined {
      // A dummy check to for reactivity around our non-proxy value
      return this._originalChanged > -1 ? _originalValue : _originalValue;
    },

    set originalValue(o: T | undefined) {
      _originalValue = o;
      this._originalChanged++;
    },
  };

  // Push the parent observable into each child FieldState. For the child FieldStates to be able
  // to use this and trigger reactivity, we have to do this after calling `observable`.
  const o = observable(obj);
  fieldNames.forEach(key => {
    (o as any)[key].parent = o;
    // Let ListFieldStates auto-sync the proxy value back into original
    if ("autorun" in (o as any)[key]) {
      autorun(() => (o as any)[key]["autorun"]());
    }
  });

  return o as ObjectState<T>;
}

function newValueFieldState<T, V>(
  key: string,
  rules: Rule<T, V | null | undefined>[],
): FieldState<T, V | null | undefined> {
  // keep a copy here for reference equality
  let _originalValue = undefined as V | null | undefined;
  let _initialized = false;

  const field = {
    key,

    touched: false,

    // TODO Should we check parent.readOnly? Currently it is pushed into us.
    readOnly: false,

    rules,

    parent: (undefined as any) as ObjectState<T>,

    // private
    _originalChanged: 0,

    get value(): V {
      return (this.parent.value as any)?.[key] as V;
    },

    set value(v: V) {
      this.set(v);
    },

    get dirty(): boolean {
      return !areEqual(this.originalValue, this.value);
    },

    get valid(): boolean {
      return this.rules.every(r => r(this.value, key, this.parent) === undefined);
    },

    get errors(): string[] {
      return this.rules.map(r => r(this.value, key, this.parent)).filter(isNotUndefined);
    },

    blur() {
      // touched is readonly, but we're allowed to change it
      this.touched = true;
    },

    init(value: V | null | undefined) {
      // Currently we reserve `null` solely for "a value that was set is no longer set", i.e. that we have to
      // send `null` on the wire to GraphQL to get the field unset. Other than this specific use case, we generally
      // prefer always working `undefined` instead of `null`, so if `null` is used as an initial value, convert it over.
      this.originalValue = value === null ? undefined : isPlainObject(this.originalValue) ? toJS(value) : value;
      _initialized = true;
      this.readOnly = false;
      this.set(value);
    },

    set(value: V | null | undefined) {
      if (!_initialized) {
        throw new Error("Not initialized");
      }
      if (this.readOnly) {
        throw new Error("Currently readOnly");
      }

      // If the user has deleted/emptied a value that was originally set, keep it as `null`
      // so that our partial update to the backend correctly unsets it.
      const keepNull = !isEmpty(this.originalValue) && isEmpty(value);
      const newValue = keepNull ? null : isEmpty(value) ? undefined : value;

      // Set the value on our parent proxy object
      (this.parent.value as any)[key] = newValue;
      // And also mirror it into our original object identity
      (this.parent.originalValue as any)[key] = newValue;
    },

    reset() {
      this.set(this.originalValue);
      this.touched = false;
    },

    save() {
      if (isPlainObject(this.originalValue)) {
        this.originalValue = toJS(this.value);
      } else {
        this.originalValue = this.value;
      }
      this.touched = false;
    },

    get originalValue(): V | null | undefined {
      // A dummy check to for reactivity around our non-proxy value
      return this._originalChanged > -1 ? _originalValue : _originalValue;
    },

    set originalValue(v: V | null | undefined) {
      _originalValue = v;
      this._originalChanged++;
    },
  };

  return field as FieldState<T, V | null | undefined>;
}

function newListFieldState<T, U>(key: string, rules: Rule<T, U[]>[], config: ObjectConfig<U>): ListFieldState<T, U> {
  // Keep a map of "item in the parent list" -> "that item's ObjectState"
  const proxyRowMap = new Map<U, ObjectState<U>>();
  const nonProxyRowMap = new Map<U, ObjectState<U>>();
  let initialized = false;

  // this is for dirty checking, not object identity
  let originalCopy = undefined as U[] | undefined;

  const list = {
    key,

    // This will be set "immediately"
    parent: (undefined as any) as ObjectState<T>,

    // Our fundamental state of wrapped Us
    get value() {
      return (this.parent.value as any)[key];
    },

    _readOnly: false,

    get readOnly(): boolean {
      return this._readOnly;
    },

    set readOnly(readOnly: boolean) {
      this._readOnly = readOnly;
      this.rows.forEach(r => (r.readOnly = readOnly));
    },

    set value(v: U[]) {
      this.set(v);
    },

    get dirty(): boolean {
      if (this.rows.some(r => r.dirty)) {
        return true;
      }
      return this.hasNewItems();
    },

    // private
    hasNewItems(): boolean {
      if (!initialized) {
        return false;
      }
      const currentList = (this.parent.originalValue as any)[key];
      const a = (currentList || []).every((e: any) => (originalCopy || []).includes(e));
      const b = (originalCopy || []).every((e: any) => (currentList || []).includes(e));
      const isSame = a && b;
      return !isSame;
    },

    // And we can derive each value's ObjectState wrapper as needed from the rowMap cache
    get rows(): ObjectState<U>[] {
      return (this.value || []).map(child => {
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
      return this.rows.some(r => r.touched) || this.hasNewItems();
    },

    set touched(touched: boolean) {
      this.rows.forEach(r => (r.touched = touched));
    },

    rules,

    get valid(): boolean {
      const value = this.value;
      const collectionValid = this.rules.every(r => r(value, key, this.parent) === undefined);
      const entriesValid = this.rows.every(r => r.valid);
      return collectionValid && entriesValid;
    },

    get errors(): string[] {
      return this.rules.map(r => r(this.value, key, this.parent)).filter(isNotUndefined);
    },

    blur() {
      this.touched = true;
    },

    init(values: U[]) {
      // On initialize, we should be passed a list of non-proxy children, which we're going to use for our
      // "does the new/old list have the same object identity" for dirty checking, so keep a copy of these.
      originalCopy = !values ? [] : [...values];
      initialized = true;
      this.readOnly = false;
      this.set(values || []);
    },

    set(values: U[]) {
      if (!initialized) {
        throw new Error("Not initialized");
      }
      if (this.readOnly) {
        throw new Error("Currently readOnly");
      }
      // We should be passed values that are non-proxies.
      (this.parent.value as any)[key] = values.map(value => {
        // value might be either a proxy (depending on how the user called it) or the non-proxy value (if initializing)
        let childState = proxyRowMap.get(value) || nonProxyRowMap.get(value);
        if (!childState) {
          childState = createObjectState(config);
          // This should be giving our child the original non-proxy value
          childState.init(value);
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
      childState.init(value);
      nonProxyRowMap.set(value, childState);
      proxyRowMap.set(childState.value, childState);
      this.value.push(childState.value);
    },

    remove(indexOrValue: number | U): void {
      if (typeof indexOrValue === "number") {
        this.value.splice(indexOrValue, 1);
      } else {
        const index = this.value.findIndex(v => v === indexOrValue);
        if (index > -1) {
          this.value.splice(index, 1);
        }
      }
    },

    reset() {
      if (originalCopy) {
        this.set(originalCopy);
        this.rows.forEach(r => r.reset());
      }
    },

    save() {
      this.rows.forEach(r => {
        r.save();
        nonProxyRowMap.set(r.originalValue, r);
      });
      originalCopy = (this.parent.originalValue as any)[key];
    },

    // Every time our value changes, update the original/non-proxy list
    autorun() {
      // Read rows before returning so we're reactive
      const rows = this.rows;
      if (!initialized) {
        return;
      }
      // We could do a smarter diff, but just clear and re-add everything for now
      const originalList = ((this.parent.originalValue as any)[key] || []) as Array<any>;
      originalList.splice(0, originalList.length);
      originalList.push(...rows.map(row => row.originalValue));
    },
  };

  return list as ListFieldState<T, U>;
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// See https://github.com/Microsoft/TypeScript/issues/21826#issuecomment-479851685
export const entries = Object.entries as <T>(o: T) => [keyof T, T[keyof T]][];

function isEmpty(value: any): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * An equals that does deep-ish equality.
 *
 * We only do non-identity equals for:
 *
 * - "plain" objects that have no custom prototype/i.e. are object literals
 * - objects that implement `toJSON`
 *
 */
function areEqual<T>(a?: T, b?: T): boolean {
  if (isPlainObject(a)) {
    return equal(toJS(a), toJS(b));
  }
  if (hasToJSON(a) || hasToJSON(b)) {
    const a1 = hasToJSON(a) ? a.toJSON() : a;
    const b1 = hasToJSON(b) ? b.toJSON() : b;
    return equal(a1, b1);
  }
  return a === b;
}

function hasToJSON(o?: unknown): o is { toJSON(): void } {
  return o && typeof o === "object" && "toJSON" in o;
}
