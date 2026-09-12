# Price list item images

PriceList API rows expose the optional sheet image through `imageUrl`. The physical `image_url`
column stores a Firebase Storage download URL or is blank for an item without a matching photo.

The price list card, invoice item picker, and order item picker show that photo beside the item
name. Each keeps its existing icon as the fallback when `imageUrl` is null or the image fails to
load. A dedicated shared `ImageOrIcon` component owns this image-or-icon rendering across the three
features. The photo is decorative because the item name appears beside it.

The PriceList form does not edit `imageUrl`; catalog image assignment is managed outside the form.

The persisted API cache version changes with this response shape so a returning browser fetches
rows containing `imageUrl` instead of continuing to display a pre-image cached row.
