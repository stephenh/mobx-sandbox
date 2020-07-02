import { click, render, type } from "@homebound/rtl-utils";
import { fireEvent } from "@testing-library/react";
import React from "react";
import { FormStateApp } from "./FormStateApp";

describe("FormStateApp", () => {
  it("save resets dirty reactively", async () => {
    const { firstName, firstName_touched, firstName_dirty, save } = await render(<FormStateApp />);
    expect(firstName_dirty()).toHaveTextContent("dirty false");

    type(firstName, "changed");
    expect(firstName_dirty()).toHaveTextContent("dirty true");
    fireEvent.blur(firstName());
    expect(firstName_touched()).toHaveTextContent("touched true");

    click(save);
    expect(firstName_dirty()).toHaveTextContent("dirty false");
    expect(firstName_touched()).toHaveTextContent("touched false");
  });

  it("originalValue is reactive", async () => {
    const { firstName_original, init } = await render(<FormStateApp />);
    expect(firstName_original()).toHaveTextContent("a1");
    click(init);
    expect(firstName_original()).toHaveTextContent("a2");
  });
});
