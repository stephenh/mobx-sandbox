// Pretend domain objects for editing in the form, i.e. as generated
// by a GraphQL schema for a `saveAuthor` mutation that takes an author
// plus the author's books.

export interface AuthorInput {
  id?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  birthday?: Date | null | undefined;
  books?: BookInput[] | null;
}

export interface BookInput {
  id?: string | null | undefined;
  title?: string | null | undefined;
}
