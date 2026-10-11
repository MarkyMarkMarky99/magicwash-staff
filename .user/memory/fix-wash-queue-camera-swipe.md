# fix/wash-queue-camera-swipe

- Booking camera shutter was dead: the open booking sheet made the page inert; the sheet now hides while `?shoot=book` is open.
- Swipe rows: swipe can start on the basket photo, threshold 40, Cancel panel 128px (was 64px).
- Typecheck and vite build pass; not tested in a browser or on a phone.
- Next: phone-test booking photo, swipe from the photo, Load/Unload/Cancel taps, then merge to main.
