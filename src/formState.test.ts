import { autorun, observable } from "mobx";
import { AuthorInput, BookInput } from "./domain";
import { createObjectState, required } from "./formState";

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
    a.set({ title: "b1" });
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
          rules: [(value) => (value?.getTime() === jan2.getTime() ? "cannot be born on jan2" : undefined)],
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

  it("maintains object identity", () => {
    const state = createAuthorInputState();
    const a1: AuthorInput = { firstName: "a1" };
    state.set(a1);
    state.firstName.set("a2");
    expect(state.originalInstance === a1).toEqual(true);
    expect(a1.firstName).toEqual("a2");
  });

  it("maintains object identity of lists", () => {
    const state = createAuthorInputState();
    const a1: AuthorInput = { firstName: "a1", books: [{ title: "t1" }] };
    state.set(a1);
    state.books.add({ title: "t2" });
    expect(state.originalInstance.books === a1.books).toEqual(true);
    expect(state.books.value.length).toEqual(2);
    expect(a1.books?.length).toEqual(2);
  });

  it("maintains unknown fields", () => {
    // Given the form is not directly editing id fields
    const state = createObjectState<AuthorInput>({
      firstName: { type: "value" },
      books: { type: "list", config: { title: { type: "value" } } },
    });
    // And we initially have ids in the input
    const a1: AuthorInput = { id: "1", firstName: "a1", books: [{ id: "2", title: "t1" }] };
    state.set(a1);
    // And we edit a few things
    state.firstName.set("a2");
    state.books.add({ title: "t2" });
    // When we get back the originalInstance
    const a2 = state.originalInstance;
    // Then it has the ids and the new values
    expect(a2).toMatchObject({
      id: "1",
      books: [{ id: "2", title: "t1" }, { title: "t2" }],
    });
  });

  it("list field valid is based on nested fields", () => {
    // Given an author that is initially valid
    const a1 = createAuthorInputState();
    a1.set({ firstName: "a1", books: [] });
    expect(a1.valid).toBeTruthy();
    // When an empty book is added
    a1.set({ firstName: "a1", books: [{}] });
    // Then it's title is invalid
    expect(a1.books.rows.length).toEqual(1);
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

  it("can remove non-first nested values by identity", () => {
    const a1 = createAuthorInputState();
    // Given we have two books
    a1.set({
      firstName: "a1",
      books: [{ title: "b1" }, { title: "b2" }],
    });
    expect(a1.books.rows[0].title.value).toEqual("b1");
    // When we remove the 2nd book
    a1.books.remove(a1.books.value[1]);
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
    a.set({});
    a.firstName.value = "b1";
    expect(a.firstName.valid).toBeTruthy();
    expect(a.lastName.valid).toBeTruthy();
    a.lastName.value = "b1";
    expect(a.firstName.valid).toBeTruthy();
    expect(a.lastName.errors).toEqual(["Last name cannot be first name"]);
  });

  it("simple value changes trigger observers", () => {
    const a = observable(
      createObjectState<BookInput>({
        title: { type: "value", rules: [required] },
      }),
    );
    let lastTitle: any = undefined;
    let ticks = 0;
    autorun(() => {
      lastTitle = a.title.value;
      ticks++;
    });
    expect(ticks).toEqual(1);
    expect(lastTitle).toEqual(undefined);
    a.set({ title: "t2" });
    expect(ticks).toEqual(2);
    expect(lastTitle).toEqual("t2");
  });
});

function createAuthorInputState() {
  return createObjectState<AuthorInput>({
    firstName: { type: "value" },
    lastName: { type: "value" },
    books: {
      type: "list",
      config: {
        title: { type: "value", rules: [required] },
      },
    },
  });
}
