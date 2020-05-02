import { createObjectState, required } from "./formState";
import { observable } from "mobx";
import { BookInput } from "./domain";

describe("formState", () => {
  it("can create a simple object", () => {
    const a = observable(
      createObjectState<BookInput>({ title: { type: "string", rules: [required] } }),
    );
    expect(a.valid).toBeFalsy();
  });

  it("can validate a simple input", () => {
    const a = observable(
      createObjectState<BookInput>({ title: { type: "string" } }),
    );
    a.title.value = "b1";
    expect(a.valid).toBeTruthy();
  });
});
