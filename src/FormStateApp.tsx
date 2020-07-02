import { useLocalStore, useObserver } from "mobx-react-lite";
import React, { useEffect } from "react";
import { createObjectState, FieldState, required } from "./formState";
import { AuthorInput } from "./formStateDomain";

export const FormStateApp: React.FC = () => {
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
        rules: [list => ((list || []).length === 0 ? "Empty" : undefined)],
        config: {
          title: { type: "value", rules: [required] },
        },
      },
    }),
  );

  useEffect(() => {
    // Simulate getting the initial form state back from a server call
    formState.init({
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
          <button data-testid="touch" onClick={() => (formState.touched = !formState.touched)}>
            touch
          </button>
          <button data-testid="reset" onClick={() => formState.reset()}>
            reset
          </button>
          <button data-testid="save" onClick={() => formState.save()}>
            save
          </button>
          <button data-testid="init" onClick={() => formState.init({ firstName: "a2" })}>
            init
          </button>
        </div>
      </header>
    </div>
  ));
};

function TextField<T>(props: { field: FieldState<T, string | null | undefined> }) {
  const { field } = props;
  // Somewhat odd: input won't update unless we use useObserver, even though our
  // parent uses `useObserver`
  return useObserver(() => (
    <div>
      {field.key}
      <input
        data-testid={field.key}
        value={field.value || ""}
        onBlur={() => field.blur()}
        onChange={e => {
          field.set(e.target.value);
        }}
      />
      <span data-testid={`${field.key}_touched`}>touched {field.touched.toString()}</span>
      <span data-testid={`${field.key}_dirty`}>dirty {field.dirty.toString()}</span>
      <span data-testid={`${field.key}_valid`}>valid {field.valid.toString()}</span>
      <span data-testid={`${field.key}_errors`}>errors {field.errors}</span>
      <span data-testid={`${field.key}_original`}>{field.originalValue}</span>
    </div>
  ));
}
