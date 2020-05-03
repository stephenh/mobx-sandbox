import React, { useEffect } from "react";
import "./App.css";
import { useLocalStore, useObserver } from "mobx-react-lite";
import { createObjectState, FieldState, required } from "./formState";
import { AuthorInput } from "./domain";
import { observable } from "mobx";

const App: React.FC = () => {
  const formState = useLocalStore(() =>
    createObjectState<AuthorInput>({
      firstName: { type: "string", rules: [required] },
      lastName: { type: "string" },
      books: {
        type: "list",
        config: {
          title: { type: "string", rules: [required] },
        },
      },
    }),
  );

  useEffect(() => {
    formState.set({
      firstName: "a1",
      books: [{ title: "b1" }, { title: "b2" }],
    });
  }, [formState]);

  return useObserver(() => (
    <div className="App">
      <header className="App-header">
        <b>Author</b>

        <div>
          First Name
          <TextField field={formState.firstName} />
        </div>

        <div>
          Last Name
          <TextField field={formState.lastName} />
        </div>

        <b>Books</b>

        {formState.books.rows.map((row, i) => {
          return (
            <div key={i}>
              Title {i}
              <TextField field={row.title} />
            </div>
          );
        })}

        <button onClick={() => formState.books.add({})}>Add book</button>

        <div>Rows valid: {formState.books.valid.toString()}</div>

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
    <>
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
    </>
  ));
}

export default App;
