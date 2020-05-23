import { autorun, observable } from "mobx";
import { AuthorInput, BookInput, DeweyDecimalClassification } from "./domain";
import { createObjectState, required } from "./formState";

const jan1 = new Date(2020, 0, 1);
const jan2 = new Date(2020, 0, 2);
const dd100: DeweyDecimalClassification = { number: "100", category: "Philosophy" };
const dd200: DeweyDecimalClassification = { number: "200", category: "Religion" };

describe("formState", () => {
  it("mobx lists maintain observable identity", () => {
    // given a parent observable
    const a = observable({ list: [] as {}[] });
    // if we observable-ize a value being pushing it on the list
    const c1 = observable({});
    a.list.push(c1);
    // then we get identify equality on the list lookups
    expect(a.list[0] === c1).toEqual(true);
  });

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
    const b1: BookInput = { title: "t1" };
    const a1: AuthorInput = { firstName: "a1", books: [b1] };
    state.set(a1);
    const b2 = { title: "t2" };
    state.books.add(b2);
    expect(state.originalInstance.books === a1.books).toEqual(true);
    expect(state.books.value.length).toEqual(2);
    expect(a1.books?.length).toEqual(2);
    expect(state.books.rows[0].originalInstance === b1).toEqual(true);
    expect(state.books.rows[1].originalInstance === b2).toEqual(true);
    expect(a1.books![1] === b2).toEqual(true);
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

  it("can remove added nested values", () => {
    const a1 = createAuthorInputState();
    // Given we have a a single book
    a1.set({ books: [{ title: "b1" }] });
    // And we push a new one
    a1.books.add({ title: "b2" });
    // When we remove the 2nd book by the row's reference value
    a1.books.remove(a1.books.rows[1].value);
    // Then only the 1st book is left
    expect(a1.books.rows.length).toEqual(1);
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

  it("knows value fields are dirty", () => {
    const a1 = createAuthorInputState();
    a1.set({ firstName: "a1" });
    expect(a1.firstName.dirty).toBeFalsy();
    a1.firstName.set("a2");
    expect(a1.firstName.dirty).toBeTruthy();
    a1.firstName.set("a1");
    expect(a1.firstName.dirty).toBeFalsy();
  });

  it("knows value fields are dirty even if rendered before the initial set", () => {
    const a1 = createAuthorInputState();
    expect(a1.firstName.value).toBeUndefined();
    a1.set({ firstName: "a1" });
    expect(a1.firstName.dirty).toBeFalsy();
    a1.firstName.set("a2");
    expect(a1.firstName.dirty).toBeTruthy();
    a1.firstName.set("a1");
    expect(a1.firstName.dirty).toBeFalsy();
  });

  it("knows nested value fields are dirty", () => {
    const a1 = createAuthorInputState();
    expect(a1.books.value).toBeUndefined();
    a1.set({ books: [{ title: "t1" }] });
    expect(a1.books.rows[0].title.dirty).toBeFalsy();
    a1.books.rows[0].title.set("t2");
    expect(a1.books.rows[0].title.dirty).toBeTruthy();
    a1.books.rows[0].title.set("t1");
    expect(a1.books.rows[0].title.dirty).toBeFalsy();
  });

  it("knows list fields are dirty", () => {
    const a1 = createAuthorInputState();
    expect(a1.books.dirty).toBeFalsy();
    a1.set({ books: [] });
    expect(a1.books.dirty).toBeFalsy();
    a1.books.add({ title: "t2" });
    expect(a1.books.dirty).toBeTruthy();
    a1.books.remove(0);
    expect(a1.dirty).toBeFalsy();
  });

  it("knows object fields are dirty", () => {
    const a1 = createAuthorInputState();
    expect(a1.dirty).toBeFalsy();
    a1.set({ firstName: "a1" });
    expect(a1.dirty).toBeFalsy();
    a1.firstName.set("a2");
    expect(a1.dirty).toBeTruthy();
    a1.firstName.set("a1");
    expect(a1.dirty).toBeFalsy();
  });

  it("knows an object's field of type object is dirty", () => {
    const a1 = createAuthorInputState();
    expect(a1.dirty).toBeFalsy();
    a1.set({
      books: [{ title: "b1", classification: dd100 }],
    });
    expect(a1.dirty).toBeFalsy();
    a1.books.rows[0].set({ classification: dd200 });
    expect(a1.dirty).toBeTruthy();
    a1.books.rows[0].set({ classification: dd100 });
    expect(a1.dirty).toBeFalsy();
  });

  it("resets values", () => {
    const a1 = createAuthorInputState();
    expect(a1.dirty).toBeFalsy();
    a1.set({
      firstName: "a1",
      lastName: "aL1",
      books: [
        { title: "b1", classification: dd100 },
        { title: "b2", classification: dd100 },
      ],
    });

    expect(a1.dirty).toBeFalsy();
    a1.firstName.set("a2");
    a1.lastName.set("aL2");
    a1.books.rows[0].set({ title: "b2" });
    a1.books.rows[1].set({ title: "bb2" });
    a1.books.add({ title: "b3" });
    expect(a1.dirty).toBeTruthy();
    a1.reset();
    expect(a1.firstName.value).toBe("a1");
    expect(a1.lastName.value).toBe("aL1");
    expect(a1.books.rows.length).toBe(2);
    expect(a1.books.rows[0].title.value).toBe("b1");
    expect(a1.books.rows[1].title.value).toBe("b2");
    expect(a1.dirty).toBeFalsy();
  });

  it("saves values into _originalState", () => {
    const a1 = createAuthorInputState();
    expect(a1.dirty).toBeFalsy();
    a1.set({
      firstName: "a1",
      lastName: "aL1",
      books: [{ title: "b1", classification: dd100 }],
    });

    expect(a1.dirty).toBeFalsy();

    // Now dirty things up.
    a1.firstName.set("a2");
    a1.lastName.set("aL2");
    a1.books.rows[0].set({ title: "b2" });
    a1.books.add({ title: "bb2" });
    // Set book 2 to an different value. Ensures our save can traverse all rows
    a1.books.rows[1].set({ title: "bb3" });

    // verify ValueFieldState is dirty, then save, then no longer dirty.
    expect(a1.firstName.dirty).toBeTruthy();
    a1.firstName.save();
    expect(a1.firstName.dirty).toBeFalsy();

    // verify ListFieldState is dirty, then save, then no longer dirty.
    expect(a1.books.dirty).toBeTruthy();
    a1.books.save();
    expect(a1.books.dirty).toBeFalsy();

    // Verify the remaining form is still dirty
    expect(a1.dirty).toBeTruthy();
    a1.save();
    // Verify after save the whole form is no longer dirty.
    expect(a1.dirty).toBeFalsy();
  });

  it("can touch everything at once", () => {
    const a1 = createAuthorInputState();
    a1.set({ firstName: "a1", books: [{ title: "b1" }] });

    expect(a1.firstName.touched).toBeFalsy();
    expect(a1.books.touched).toBeFalsy();
    expect(a1.books.rows[0].title.touched).toBeFalsy();
    expect(a1.touched).toBeFalsy();

    a1.touched = true;
    expect(a1.firstName.touched).toBeTruthy();
    expect(a1.books.touched).toBeTruthy();
    expect(a1.books.rows[0].title.touched).toBeTruthy();
    expect(a1.touched).toBeTruthy();
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
        classification: { type: "value" },
      },
    },
  });
}
