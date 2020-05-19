// Pretend domain objects for editing in the form, i.e. as generated
// by a GraphQL schema for a `saveAuthor` mutation that takes an author
// plus the author's books.

export interface AuthorInput {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  books?: BookInput[] | null;
}

export interface BookInput {
  title?: string | null | undefined;
}
