# feat/customer-registration

- Goal: staff register a new customer; server assigns CustomerID and a free label from CustomerIDMapping.
- Design: `docs/features/customers/registration.md`; built and committed.
- Accepted: two concurrent creates can pick the same label or both pass the duplicate-phone check.
- Open: Customers PATCH route is advertised but the sheet contract disallows update, so it fails.
- Open: no tests for the POST route response, form validation rendering, or an empty label pool.
- Browser-tested OK 2026-09-29 (incl. 10-digit phone input, English labels, no date field); Phone column set to text in the sheet by user.
- Deferred by user: duplicate-phone check misses legacy phones that lost their leading 0, and numeric GViz Phone values.
- Next: merge.
