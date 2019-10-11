import {observable, autorun, action} from "mobx";
import { deepObserve } from "mobx-utils";

const personData = {
  name: "John",
  age: 42,
  address: {
    street: 1234,
    city: "omaha",
  }
};

describe("mobx", () => {

  let person: typeof personData;
  let lastSeenAge = 0;
  let lastSeenStreet = 0;
  let lastSeenCity = "";
  let ageTick = 0;
  let streetTick = 0;
  let cityTick = 0;
  let personTick = 0;

  beforeEach(() => {
    ageTick = 0;
    streetTick = 0;
    cityTick = 0;
    personTick = 0;

    person = observable(personData);

    autorun(() => {
      lastSeenAge = person.age;
      ageTick++;
    });

    autorun(() => {
      lastSeenStreet = person.address.street;
      streetTick++;
    });

    autorun(() => {
      lastSeenCity = person.address.city;
      cityTick++;
    });

    deepObserve(person, () => {
      personTick++;
    });
  });

  it("runs", () => {
    person.age = 1;
    expect(person.address.street).toEqual(1234);
  });

  it("runs autorun on top-level mutate", () => {
    person.age = 1;
    expect(lastSeenAge).toEqual(1);
    expect(ageTick).toEqual(2);
    expect(streetTick).toEqual(1);
  });

  it("runs autorun on nested mutate", () => {
    person.address.street = 1;
    expect(streetTick).toEqual(2);
    expect(ageTick).toEqual(1);
  });

  it("runs autorun on nested mutate two", () => {
    person.address.city = "denver";
    expect(lastSeenCity).toEqual("denver");
    expect(cityTick).toEqual(2);
    expect(streetTick).toEqual(1);
  });

  it("can deep observe", () => {
    person.age = 1;
    person.address.street = 1;
    person.address.city = "denver";
    expect(ageTick).toEqual(2);
    expect(streetTick).toEqual(2);
    expect(cityTick).toEqual(2);
    expect(personTick).toEqual(3);
  });

  it("keeps deep listeners", () => {
    person.address = { street: 2, city: "santa rosa" };
    expect(lastSeenStreet).toEqual(2);
    expect(lastSeenCity).toEqual("santa rosa");
    expect(streetTick).toEqual(2);
    expect(cityTick).toEqual(2);
  });

  it("keeps deep listeners on spread", () => {
    person.address = { ...person.address, street: 2 };
    // street was supposed to change/tick
    expect(lastSeenStreet).toEqual(2);
    expect(streetTick).toEqual(2);
    // but city didn't change and still registered a tick
    expect(lastSeenCity).toEqual(personData.address.city);
    expect(cityTick).toEqual(2);
  });
});
