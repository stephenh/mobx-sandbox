The ObjectState for an `AuthorInput` ends up being a proxy that looks like:

- firstName (`FieldState`)
  - value --> reads/writes from `../value[firstName]`
- lastName (`FieldState`)
  - value --> reads/writes from `../value[lastName]`
- books (`ListState`)
  - value --> reads/writes from `../value[books]`
  - [i] `BookInput` ObjectState
    - should get `../value[books][i]` proxy & non-proxy
- value (proxy version of `AuthorInput`)

  - firstName (proxy `string`)
  - lastName (proxy `string`)
  - books (proxy `BookInput[]`)

I.e. all of the "data" (primitives, lists, objects) will be in a tree in the top-level `state.value` proxy, and all of the `FieldState` references should be a separate tree of `state.firstName`/etc. that still refer/zip to their corresponding data in the `state.value` proxy.
