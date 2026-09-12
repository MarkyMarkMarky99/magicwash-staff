# Price list item images

PriceList API rows expose the optional sheet image through `imageUrl`. The physical `image_url`
column stores a Firebase Storage download URL or is blank for an item without a matching photo.

The price list card keeps the photo as a compact thumbnail for scanning and editing rows. Invoice
and order item pickers use a two-column product grid within the picker overlay:
the larger image helps staff locate an item visually, while the name, item code, and price remain
visible in every card. Picker images use `contain` so a garment, towel, shoe, or pillow is not cropped
out of its square source image. Each keeps its
existing icon as the fallback when `imageUrl` is null or the image fails to load. A dedicated shared
`ImageOrIcon` component owns this image-or-icon rendering across the three features. The photo is
decorative because the item name remains visible in the card. This redesign includes a dedicated
shared-component extension: `ImageOrIcon` supports `fit="contain"` for picker cards while the compact
admin row keeps its cover crop.

The PriceList form does not edit `imageUrl`; catalog image assignment is managed outside the form.

The persisted API cache version changes with this response shape so a returning browser fetches
rows containing `imageUrl` instead of continuing to display a pre-image cached row.
