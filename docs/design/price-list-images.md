# Price list item images

PriceList API rows expose the optional sheet image through `imageUrl`. The physical `image_url`
column stores a Firebase Storage download URL or is blank for an item without a matching photo.

The price list card keeps the photo as a compact thumbnail for scanning and editing rows. The
shared invoice/order picker uses larger photos in its item-type grid and variant sheet. Picker
images use `contain` so the full garment, towel, shoe, or pillow remains visible. Each image keeps
an icon fallback when `imageUrl` is null or loading fails. The photo is decorative because a text
label appears beside or below it. The dedicated shared `ImageOrIcon` component supports
`fit="contain"` for the picker's local product card and variant choices while the compact admin row
keeps its cover crop.

The PriceList form does not edit `imageUrl`; catalog image assignment is managed outside the form.

The persisted API cache version changes with this response shape so a returning browser fetches
rows containing `imageUrl` instead of continuing to display a pre-image cached row.
