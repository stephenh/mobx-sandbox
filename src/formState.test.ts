import { createObjectState, required } from "./formState";
import { observable } from "mobx";
import { AuthorInput, BookInput } from "./domain";

describe("formState", () => {
  it("can create a simple object", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "string", rules: [required] },
      }),
    );
    expect(a.valid).toBeFalsy();
  });

  it("can validate a simple input", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "string" },
      }),
    );
    a.title.value = "b1";
    expect(a.valid).toBeTruthy();
  });

  it("can set values", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "string" },
      }),
    );
    a.set({ title: "b1" });
    expect(a.title.value).toEqual("b1");
  });

  it("can set nested values", () => {
    const a = observable(
      createObjectState<AuthorInput>({
        firstName: { type: "string" },
        lastName: { type: "string" },
        books: {
          type: "list",
          config: {
            title: { type: "string" },
          },
        },
      }),
    );
    a.set({
      firstName: "a1",
      books: [{ title: "b1" }],
    });
    expect(a.books.rows[0].title.value).toEqual("b1");
  });
});
