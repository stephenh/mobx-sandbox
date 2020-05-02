import React from 'react';
import './App.css';
import { useLocalStore, useObserver } from "mobx-react-lite";

interface AuthorInput {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
}

const required = (v: any) => v !== undefined && v !== null && v !== "";

interface FieldState<T> {
  value: T
  touched: boolean;
  valid: boolean;
  rules: Array<(value: T) => boolean>;
  blur(): void;
  set(value: T): void;
}

type FormStore<T> = { [P in keyof T]-?: FieldState<T[P]> } & {
  toInput(): T;
}

const App: React.FC = () => {
  const formState = useLocalStore<FormStore<AuthorInput>>(() => ({
    firstName: {
      value: "",
      touched: false,
      rules: [required],
      get valid(): boolean {
        return this.rules.every(r => r(this.value));
      },
      blur() {
        this.touched = true;
      },
      set(v: string) {
        this.value = v;
      }
    },
    lastName: {
      value: "",
      touched: false,
      rules: [],
      get valid(): boolean {
        return this.rules.every(r => r(this.value));
      },
      blur() {
        this.touched = true;
      },
      set(v: string) {
        this.value = v;
      }
    },
    toInput() {
      return {
        firstName: this.firstName.value,
        lastName: this.lastName.value,
      };
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
        </div>
      </header>
    </div>
  ));
}

export default App;
