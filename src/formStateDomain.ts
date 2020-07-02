// Pretend domain objects for editing in the form, i.e. as generated
// by a GraphQL schema for a `saveAuthor` mutation that takes an author
// plus the author's books.

export const jan1 = new Date(2020, 0, 1);
export const jan2 = new Date(2020, 0, 2);
export const dd100: DeweyDecimalClassification = { number: "100", category: "Philosophy" };
export const dd200: DeweyDecimalClassification = { number: "200", category: "Religion" };

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
  classification?: DeweyDecimalClassification;
}

export interface DeweyDecimalClassification {
  number: string;
  category: string;
}
