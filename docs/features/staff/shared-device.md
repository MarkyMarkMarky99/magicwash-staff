# Shared shop device and staff card operator

A shop device signs in with one Google account linked to an active Staff row with role `device`. Each employee scans a personal staff card with the barcode gun to become the operator. The fixed banner shows `ผู้ใช้งาน: <name>` while selected and `ยิงบัตรพนักงานก่อนทำงาน` otherwise.

Staff cards use the trimmed, case-insensitive `MWS-` prefix. The shared scanner sends these codes only to the operator flow, while ordinary workflow scanners skip them. Device and admin sessions resolve a card with `GET /api/auth/card?code=<code>`. The server looks up the StaffId after the prefix in active approved Staff rows and returns only the StaffId and name. An unknown or inactive card gives the Thai notice `ไม่พบบัตรพนักงานนี้`.

A successful scan replaces the current operator and starts a new one-hour period from the scan time. Operator StaffId, name, and scan time are persisted in localStorage when available and restored only while unexpired. State is mirrored synchronously into the frontend actor configuration, checked on load and every thirty seconds, and cleared at its one-hour deadline. Signing out clears the operator. A storage failure does not prevent an in-memory operator selection.

Requests include `X-Operator-Id` while an operator is selected. For a device session outside the auth and staff modules, the gateway resolves that StaffId against the active allow-list. An unknown or inactive operator is forbidden. A valid operator becomes the request staff member with role capped to `staff`, including when the employee's own role is admin. Without an operator, GET requests can read using the device identity; all other methods are forbidden with `Scan a staff card first`. Auth and staff retain their own access rules and bypass operator substitution.

The server takes write actors from the resolved session StaffId. Client-supplied actor fields remain in existing API requests for compatibility but cannot select who performed the write. Payments and invoices receive the StaffId separately from their business request payloads.

The card code is `MWS-<StaffId>`, derived from the StaffId, not stored, and never reissued. A lost card is reprinted with the same code. The login reader reads A:I.
