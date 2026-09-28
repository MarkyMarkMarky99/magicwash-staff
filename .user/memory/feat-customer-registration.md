# feat/customer-registration

- Goal: staff register a new customer; server assigns CustomerID and a free label from CustomerIDMapping.
- Design: `docs/features/customers/registration.md`; built, committed, not yet tried against live sheets.
- Accepted: two concurrent creates can pick the same label or both pass the duplicate-phone check.
- Open: Customers PATCH route is advertised but the sheet contract disallows update, so it fails.
- Open: no tests for the POST route response, form validation rendering, or an empty label pool.
- Next: browser-test `/customers/new` against real sheets, then merge.
