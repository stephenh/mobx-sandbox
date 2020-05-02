import React, { useEffect } from "react";
import "./App.css";
import { useLocalStore, useObserver } from "mobx-react-lite";
import { createObjectState, required } from "./formState";
import { AuthorInput } from "./domain";

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
            onBlur={() => formState.lastName.blur()}
            onChange={(e) => formState.lastName.set(e.target.value)}
          />
          touched: {formState.lastName.touched.toString()}
          valid: {formState.lastName.valid.toString()}
          errors: {formState.lastName.errors}
        </div>

        <b>Books</b>

        {formState.books.rows.map((row, i) => {
          return (
            <div>
              Title {i}
              <input
                value={row.title.value || ""}
                onBlur={() => row.title.blur()}
                onChange={(e) => row.title.set(e.target.value)}
              />
              touched: {row.title.touched.toString()}
              valid: {row.title.valid.toString()}
              errors: {row.title.errors}
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

export default App;
