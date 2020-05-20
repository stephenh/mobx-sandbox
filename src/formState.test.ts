import { createObjectState, required } from "./formState";
import { observable } from "mobx";
import { AuthorInput, BookInput } from "./domain";

const jan1 = new Date(2020, 0, 1);
const jan2 = new Date(2020, 0, 2);

describe("formState", () => {
  it("can create a simple object", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "value", rules: [required] },
      }),
    );
    expect(a.valid).toBeFalsy();
  });

  it("can validate a simple input", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "value" },
      }),
    );
    a.title.value = "b1";
    expect(a.valid).toBeTruthy();
  });

  it("can set values", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "value" },
      }),
    );
    a.set({ title: "b1" });
    expect(a.title.value).toEqual("b1");
  });

  it("can read values", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "value" },
      }),
    );
    a.set({ title: "b1" });
    expect(a.value.title).toEqual("b1");
  });

  it("can set dates", () => {
    const a = observable(
      createObjectState<AuthorInput>({
        birthday: {
          type: "value",
          rules: [(value) => value?.getTime() === jan2.getTime() ? "cannot be born on jan2" : undefined]
        },
      }),
    );
    a.set({ birthday: jan1 });
    expect(a.birthday.value).toEqual(jan1);

    a.birthday.set(jan2);
    expect(a.birthday.errors).toEqual(["cannot be born on jan2"]);
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

  it("can add nested values", () => {
    const a1 = createAuthorInputState();
    // Given we already have a book
    a1.set({
      firstName: "a1",
      books: [{ title: "b1" }],
    });
    expect(a1.books.rows[0].title.value).toEqual("b1");
    // When another book is added
    a1.books.add({ title: "b2" });
    // Then both books are visible
    expect(a1.books.rows[0].title.value).toEqual("b1");
    expect(a1.books.rows[1].title.value).toEqual("b2");
  });

  it("can access nested values", () => {
    const a1 = createAuthorInputState();
    // Given we have two books
    a1.set({
      firstName: "a1",
      books: [{ title: "b1" }, { title: "b2" }],
    });
    // We can see what each book looks like
    expect(a1.books.value[0].title).toEqual("b1");
    expect(a1.books.value[1].title).toEqual("b2");
  });

  it("can remove nested values", () => {
    const a1 = createAuthorInputState();
    // Given we have two books
    a1.set({
      firstName: "a1",
      books: [{ title: "b1" }, { title: "b2" }],
    });
    expect(a1.books.rows[0].title.value).toEqual("b1");
    // When we remove the 1st book
    a1.books.remove(0);
    // Then only the 2nd book is left
    expect(a1.books.rows.length).toEqual(1);
    expect(a1.books.rows[0].title.value).toEqual("b2");
  });

  it("can remove non-first nested values", () => {
    const a1 = createAuthorInputState();
    // Given we have two books
    a1.set({
      firstName: "a1",
      books: [{ title: "b1" }, { title: "b2" }],
    });
    expect(a1.books.rows[0].title.value).toEqual("b1");
    // When we remove the 2nd book
    a1.books.remove(1);
    // Then only the 1st book is left
    expect(a1.books.rows.length).toEqual(1);
    expect(a1.books.rows[0].title.value).toEqual("b1");
  });

  it("can validate the nested collection directly", () => {
    const a1 = createAuthorInputState();
    a1.books.rules.push((b) => (b.length === 0 ? "Empty" : undefined));
    // Given we already have a book
    a1.set({ firstName: "a1", books: [] });
    expect(a1.books.valid).toBeFalsy();
    expect(a1.books.errors).toEqual(["Empty"]);
  });

  it("can validate across fields", () => {
    const a = observable(
      createObjectState<Omit<AuthorInput, "books">>({
        firstName: { type: "value", rules: [] },
        lastName: {
          type: "value",
          rules: [
            (v, k, o) => {
              return o.firstName.value === o.lastName.value ? "Last name cannot be first name" : undefined;
            },
          ],
        },
      }),
    );
    a.firstName.value = "b1";
    expect(a.firstName.valid).toBeTruthy();
    expect(a.lastName.valid).toBeTruthy();
    a.lastName.value = "b1";
    expect(a.firstName.valid).toBeTruthy();
    expect(a.lastName.errors).toEqual(["Last name cannot be first name"]);
  });
});

function createAuthorInputState() {
  return observable(
    createObjectState<AuthorInput>({
      firstName: { type: "value" },
      lastName: { type: "value" },
      books: {
        type: "list",
        config: {
          title: { type: "value", rules: [required] },
        },
      },
    }),
  );
}
