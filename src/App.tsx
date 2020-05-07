import React, { useEffect } from "react";
import "./App.css";
import { useLocalStore, useObserver } from "mobx-react-lite";
import { createObjectState, FieldState, required } from "./formState";
import { AuthorInput } from "./domain";

const App: React.FC = () => {
  // Configure the fields/behavior for AuthorInput's fields
  const formState = useLocalStore(() =>
    createObjectState<AuthorInput>({
      firstName: { type: "string", rules: [required] },
      lastName: { type: "string" },
      books: {
        type: "list",
        rules: [(list) => list.length === 0 ? "Empty" : undefined],
        config: {
          title: { type: "string", rules: [required] },
        },
      },
    }),
  );

  useEffect(() => {
    // Add cross-field rules
    const firstLastRule = () => {
      if (formState.firstName.value === formState.lastName.value) {
        return "Last name cannot equal first name"
      }
    }
    formState.lastName.rules.push(firstLastRule);
  }, [formState]);

  useEffect(() => {
    // Simulate getting the initial form state back from a server call
    formState.set({
      firstName: "a1",
      books: [{ title: "b1" }, { title: "b2" }],
    });
  }, [formState]);

  return useObserver(() => (
    <div className="App">
      <header className="App-header">
        <b>Author</b>
        <TextField field={formState.firstName} />
        <TextField field={formState.lastName} />

        <b>Books</b>
        {formState.books.rows.map((row, i) => {
          return (
            <div key={i}>
              Book {i} <TextField field={row.title} />
              <button onClick={() => formState.books.remove(row.value)}>X</button>
            </div>
          );
        })}

        <button onClick={() => formState.books.add({})}>Add book</button>

        <div>Rows valid: {formState.books.valid.toString()} {formState.books.errors}</div>

        <div>form valid {formState.valid.toString()}</div>
      </header>
    </div>
  ));
};

function TextField(props: { field: FieldState<string | null | undefined> }) {
  const field = props.field;
  // Somewhat odd: input won't update unless we use useObserver, even though our
  // parent uses `useObserver`
  return useObserver(() => (
    <div>
      {field.key}
      <input
        value={field.value || ""}
        onBlur={() => field.blur()}
        onChange={(e) => {
          field.set(e.target.value);
        }}
      />
      touched: {field.touched.toString()}
      valid: {field.valid.toString()}
      errors: {field.errors}
    </div>
  ));
}

export default App;
