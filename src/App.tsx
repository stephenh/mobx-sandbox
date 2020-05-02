import React from 'react';
import './App.css';
import { useLocalStore, useObserver } from "mobx-react-lite";

interface AuthorInput {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
}

interface FieldState<T> {
  value: T
  touched: boolean;
  valid: boolean;
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
      valid: true,
      touched: false,
      blur() {
        this.touched = true;
      },
      set(v: string) {
        this.value = v;
      }
    },
    lastName: {
      value: "",
      valid: true,
      touched: false,
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
        </div>
      </header>
    </div>
  ));
}

export default App;
