/**
 * Wraps a given input/DTO `T` for editing in a form.
 *
 * Note that this can be hierarchical by having by having a field of `RowsFieldState` that
 * themselves each wrap an `ObjectState`, i.e.:
 *
 * ```
 * ObjectState for author
 *   - firstName: FieldState
 *   - lastName: FieldState
 *   - rows: RowsFieldState
 *     - [0]: ObjectState for book 1
 *       - title: FieldState
 *     - [1]: ObjectState for book 2
 *       - title: FieldState
 * ```
 */
export type ObjectState<T> = FieldStates<T> & {
  valid: boolean;
  toInput(): T;
}

type FieldStates<T> = { [P in keyof T]-?: T[P] extends Array<infer U> ? RowsFieldState<U> : FieldState<T[P]> }

/** A validation rule, given the value and name, return the error string if valid, or undefined if valid. */
export type Rule<T> = (value: T, name: string) => string | undefined;

/** A rule that validates `value` is not `undefined`, `null`, or empty string. */
export const required: Rule<any> = (v: any) => v !== undefined && v !== null && v !== "" ? undefined : "Required";

/**
 * The current state of a field in the form, i.e. it's value but also touched/validation/etc. state.
 *
 * This API also provides hooks for form elements to call into, i.e. `blur()` and `set(...)` that will
 * update the field state and re-render, i.e. when including in an `ObjectState`-typed literal that is
 * an mbox `useLocalStore`/observable.
 */
// TODO: How should T handle null | undefined?
export interface FieldState<T> {
  value: T
  touched: boolean;
  valid: boolean;
  rules: Rule<T | null | undefined>[];
  errors: string[];
  blur(): void;
  set(value: T): void;
}

/** T is the type of each row. */
interface RowsFieldState<T> extends FieldState<T[]> {
}

type ObjectConfig<T> = {
  [P in keyof T]: any;
}

export function createObjectState<T>(config: ObjectConfig<T>): ObjectState<T> {
  const fieldStates = Object.entries(config).map(([key, value]) => {
    if (key === "firstName" || key === "lastName") {
      return [key, newTextFieldState()];
    } else {
      return [key, newRowsFieldState()];
    }
  })
  const fieldNames = Object.keys(config);
  return {
    ...Object.fromEntries(fieldStates),
    get valid(): boolean {
      // TODO Not entirely sure why the typeof string is needed here
      return fieldNames.map(name => (this as any)[name]).every(f => f.valid);
    }
  } as ObjectState<T>;
}


function newTextFieldState(): FieldState<string | null | undefined> {
  return {
    value: "",
    touched: false,
    rules: [required],
    get valid(): boolean {
      console.log("validating");
      return this.rules.every(r => r(this.value, "firstName") === undefined);
    },
    get errors(): string[] {
      return this.rules.map(r => r(this.value, "firstName")).filter(isNotUndefined);
    },
    blur() {
      this.touched = true;
    },
    set(v: string) {
      this.value = v;
    }
  };
}

function newRowsFieldState<T>(): RowsFieldState<T> {
  return {
    value: [],
    touched: false,
    rules: [],
    get valid(): boolean {
      return this.rules.every(r => r(this.value, "firstName") === undefined);
    },
    get errors(): string[] {
      return this.rules.map(r => r(this.value, "firstName")).filter(isNotUndefined);
    },
    blur() {
      this.touched = true;
    },
    set(v: T[]) {
      this.value = v;
    }
  };
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

