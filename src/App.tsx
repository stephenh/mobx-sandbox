import React from 'react';
import './App.css';
import { useLocalStore, useObserver } from "mobx-react-lite";

interface AuthorInput {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
}

/** A validation rule, given the value and name, return the error string if valid, or undefined if valid. */
type Rule<T> = (value: T, name: string) => string | undefined;

/** A rule that validates `value` is not `undefined`, `null`, or empty string. */
const required: Rule<any> = (v: any) => v !== undefined && v !== null && v !== "" ? undefined : "Required";

/** The current state of a field in the form, i.e. it's value but also touched/validation/etc. state. */
interface FieldState<T> {
  value: T
  touched: boolean;
  valid: boolean;
  rules: Rule<T | null | undefined>[];
  errors: string[];
  blur(): void;
  set(value: T): void;
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function newTextFieldState(): FieldState<string | null | undefined> {
  return {
    value: "",
    touched: false,
    rules: [required],
    get valid(): boolean {
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

type FormStore<T> = { [P in keyof T]-?: FieldState<T[P]> } & {
  valid: boolean;
  toInput(): T;
}

const App: React.FC = () => {
  const formState = useLocalStore<FormStore<AuthorInput>>(() => ({
    firstName: newTextFieldState(),
    lastName: newTextFieldState(),
    toInput() {
      return {
        firstName: this.firstName.value,
        lastName: this.lastName.value,
      };
    },
    get valid(): boolean {
      return this.firstName.valid && this.lastName.valid;
    }
  }));

  return useObserver(() => (
    <div className="App">
      <header className="App-header">
        <div>
        First Name
        <input
          id="firstName"
          value={formState.firstName.value || ""}
          onBlur={() => formState.firstName.blur()}
          onChange={(e) => formState.firstName.set(e.target.value)}
        />
        touched: {formState.firstName.touched.toString()}
        valid: {formState.firstName.valid.toString()}
        errors: {formState.firstName.errors}
        </div>

        <div>
          Last Name
          <input
            id="lastName"
            value={formState.lastName.value || ""}
            onBlur={() => formState.lastName.blur() }
            onChange={(e) => formState.lastName.set(e.target.value)}
          />
          touched: {formState.lastName.touched.toString()}
          valid: {formState.lastName.valid.toString()}
          errors: {formState.lastName.errors}
        </div>

        <div>
          form valid {formState.valid.toString()}
        </div>
      </header>
    </div>
  ));
}

export default App;
