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
    const a1 = createAuthorInputState();
    a1.set({
      firstName: "a1",
      books: [{ title: "b1" }],
    });
    expect(a1.books.rows[0].title.value).toEqual("b1");
  });

  it("list field valid is based on nested fields", () => {
    // Given an author that is initially valid
    const a1 = createAuthorInputState();
    a1.set({ firstName: "a1" });
    expect(a1.valid).toBeTruthy();
    // When an empty book is added
    a1.set({ firstName: "a1", books: [{}] });
    // Then it's title is invalid
    expect(a1.books.rows[0].title.valid).toBeFalsy();
    // And the books collection itself is invalid
    expect(a1.books.valid).toBeFalsy();
    // And the author itself is also invalid
    expect(a1.valid).toBeFalsy();
  });
});

function createAuthorInputState() {
  return observable(
    createObjectState<AuthorInput>({
      firstName: { type: "string" },
      lastName: { type: "string" },
      books: {
        type: "list",
        config: {
          title: { type: "string", rules: [required] },
        },
      },
    }),
  );
}
