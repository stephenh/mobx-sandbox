import React from "react";
import "./App.css";
import { useLocalStore, useObserver } from "mobx-react-lite";
import { createObjectState, required } from "./formState";
import { AuthorInput } from "./domain";

const App: React.FC = () => {
  const formState = useLocalStore(() =>
    createObjectState<AuthorInput>({
      firstName: { type: "string", rules: [required] },
      lastName: { type: "string" },
      books: { type: "list" },
    }),
  );

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
            onBlur={() => formState.lastName.blur()}
            onChange={(e) => formState.lastName.set(e.target.value)}
          />
          touched: {formState.lastName.touched.toString()}
          valid: {formState.lastName.valid.toString()}
          errors: {formState.lastName.errors}
        </div>

        <div>Rows valid: {formState.books.valid.toString()}</div>

        <div>form valid {formState.valid.toString()}</div>
      </header>
    </div>
  ));
};

export default App;
