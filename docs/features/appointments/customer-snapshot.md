# Customer details required for booking

Creating an appointment requires a customer ID, name, customer code, phone number,
and address. The customer `location` field is optional: customers with an address
but no location can still be booked. The create request sends an empty string for
a missing location so the appointment snapshot can be stored consistently.

The form blocks submission when one of the required fields is empty. The
appointments API applies the same requirements at its request boundary.
