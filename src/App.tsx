import React, { useEffect } from "react";
import "./App.css";
import { useLocalStore, useObserver } from "mobx-react-lite";
import { createObjectState, FieldState, required } from "./formState";
import { AuthorInput } from "./domain";

const App: React.FC = () => {
  // Configure the fields/behavior for AuthorInput's fields
  const formState = useLocalStore(() =>
    createObjectState<AuthorInput>({
      firstName: { type: "value", rules: [required] },
      lastName: {
        type: "value",
        rules: [
          (v, k, o) => {
            return o.firstName.value === o.lastName.value ? "Last name cannot equal first name" : undefined;
          },
        ],
      },
      books: {
        type: "list",
        rules: [(list) => ((list || []).length === 0 ? "Empty" : undefined)],
        config: {
          title: { type: "value", rules: [required] },
        },
      },
    }),
  );

  useEffect(() => {
    // Simulate getting the initial form state back from a server call
    formState.set({
      firstName: "a1",
      books: [...Array(2)].map((_, i) => ({
        title: `b${i}`,
        classification: { number: `10${i + 1}`, category: `Test Category ${i}` },
      })),
    });
  }, [formState]);

  return useObserver(() => (
    <div className="App">
      <header className="App-header">
        <b>Author</b>
        <TextField field={formState.firstName} />
        <TextField field={formState.lastName} />

        <b>Books</b>
        {formState.books.rows?.map((row, i) => {
          return (
            <div key={i}>
              Book {i} <TextField field={row.title} />
              <button onClick={() => formState.books.remove(row.value)}>X</button>
            </div>
          );
        })}

        <button onClick={() => formState.books.add({})}>Add book</button>

        <div>
          rows touched {formState.books.touched.toString()} valid {formState.books.valid.toString()} dirty{" "}
          {formState.books.dirty.toString()} {formState.books.errors}
        </div>

        <div>
          form touched {formState.touched.toString()} valid {formState.valid.toString()} dirty{" "}
          {formState.dirty.toString()}
          <button onClick={() => (formState.touched = !formState.touched)}>touch</button>
        </div>
      </header>
    </div>
  ));
};

function TextField(props: { field: FieldState<any, string | null | undefined> }) {
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
      touched {field.touched.toString()}
      dirty {field.dirty.toString()}
      valid {field.valid.toString()}
      errors {field.errors}
    </div>
  ));
}

export default App;
