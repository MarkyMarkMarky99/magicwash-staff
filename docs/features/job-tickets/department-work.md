# Department work pages

The four department pages use `/departments/:department`: `washing`, `drycleaning`, `ironing`, and `packaging`. These map to the JobTicket department values `Washing`, `DryCleaning`, `Ironing`, and `Packaging`. An unknown value shows a not-found state.

Each page loads Pending and In Progress tickets for its department through the existing job-ticket list API. It also loads Completed tickets ordered by `completedAt` descending, stopping when the first completion before the current Bangkok date appears. The combined list is capped at 2,000 tickets; a warning marks a capped list as incomplete. Loading, errors with retry, and empty results use the list page pattern.
Job-ticket GETs bypass the response cache so reopening the work queue reads current statuses.

The `status` query selects ALL, PENDING, IN PROGRESS, or COMPLETED. Tab counts and sorting use the loaded list in memory. The `group` query selects `item` for a flat garment grid or defaults to `order` for order cards. Both controls replace the current URL entry. Orders sort by nearest due date. Each order card shows customer, order ID, due date, a completed percentage ring, and counts for the three statuses. Expanding a card shows only garments matching the active tab. Garments use the shared square image card, showing photo evidence when present.

Order due dates and customer IDs come from the already loaded work-order list. Missing orders are fetched individually with parallel, deduplicated detail requests. Names come from the preloaded customer list, falling back to customer ID.

The scan button opens the shared scanner with `scan=1` in the query. Browser Back closes an overlay opened from the page; closing a refreshed scanner deep link removes the query with replace. The scanner keeps reading until closed. Its result card uses loaded tickets to preview a Pending → In Progress or In Progress → Completed transition, or explains an unknown or completed tag. It never writes a status.

Scan write integration comes in a later round.
