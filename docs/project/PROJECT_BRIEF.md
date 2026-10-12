# Project Brief — Dev-X Book Store (Plan C)

Independent full-stack build derived from one existing single-file storefront UI (`reference/original-ui/dev-x-book-store-8-2.html`, Arabic RTL).
Goal: keep that UI as the visual source of truth and replace its in-browser mock API with a real backend (catalog, accounts, orders, manual-payment review, admin).

## What the source actually contains (audited, not assumed)
| Item | Finding |
|---|---|
| File | 1 HTML file, 3,393,565 bytes, 1,493 lines; SHA-256 `801c61ca…d38ddbb` |
| Structure | Single-page app: markup lines 288–304, one `<script>` lines 305–1492, hash router (`#/…`), 2 inline `<style>` blocks |
| Embedded media | 79 base64 images (69 product photos, 3 hero book covers, 3 payment logos, 3 e-wallet logos, 1 mascot image on the categories page) → extracted to `reference/original-ui/extracted-assets/` |
| External deps | Google Fonts "Cairo" only. No frameworks, no package manager, no tests |
| Backend | **None.** `MOCK()` in the page emulates `/api/*` in `localStorage` (`dx_demo_db`). `DX_CONFIG.apiBase=''`; setting it switches `api()` to real `fetch` with the same paths (`Authorization: Bearer`, `X-Admin-Token`) |
| Language/direction | `lang="ar" dir="rtl"` only. **No English/LTR UI exists in the source** |
| Colors | `--navy #041F60`, `--azure #145DA0`, `--orange #FF751F`, `--offwhite #F5F2EE`, also `--burgundy #5C0606`, `--purple #7500A9`, `--sale #D4101A`. `#102D68` does **not** appear in the file |

## Real UI inventory (routes found in the script)
`/` home (hero 3D book scene, category cards, offers strip) · `/categories` (with "Dev-X future" promo block) · `/category/:id` · `/search` (q, offers, available, sort) · `/product/:id` (variants size/colour, gallery, rating & reviews, share, wishlist heart) · `/cart` · `/checkout` (delivery vs branch pickup, saved addresses, payment method radios, coupon box, order summary) · `/pay/:id` (submit transfer reference) · `/order/:id` & `/track` (lookup by order no. + phone) · `/branches` · `/payment` (how-to-pay page) · `/login` (phone+name or email+password, Google/Facebook buttons) · `/register` · `/recover` · `/account` (profile, addresses, orders) · `/settings` · `/notifications` · `/support` (complaint/inquiry form + status lookup) · `/policy/:key` (returns, shipping, privacy, terms) · `/admin` (tabs: overview, orders, products, coupons, complaints+reviews inbox, branches, settings incl. tiers/payment accounts/shipping/contact/policies/admin password) · header search, cart badge, bell, floating sidebar, footer.
Catalog in source: 69 products (books 3, tshirts 29, notebooks 6, other 31 = bags/mugs/stickers/caps/bottles), 164 variants, 17 on sale, 3 coupons, 15 branch names (no addresses), 4 payment methods (COD, Fawry, InstaPay, e-wallet with Vodafone/WE/Orange chips), 3 order-total discount tiers (800/1600/2400 EGP → 10/15/20 %).

## Working vs visual-only vs unknown
* **Working only inside the mock (browser-local, per device):** everything above, including pricing, stock decrement, coupons, orders, reviews, notifications, admin.
* **Visual-only / simulated:** Google/Facebook login (a modal asking name+email), payments (no gateway: user types a reference number, admin marks "paid"), "Fawry code", e-wallet chips, product share.
* **Insecure by design (demo):** plaintext user passwords, client-side SHA-256 admin password in localStorage, admin = a client-side flag, login by phone+name.
* **Not in the source (do not invent):** English UI, governorate selector (city is free text), e-books/entitlements, surveys/questionnaires, bundles, add-ons, a wishlist page (heart state only in `dx_wish`), server-side cart (cart is `dx_cart`), delivery-area pricing (shipping fee `null`).

## Requirements still to confirm with the owner
Arabic+English switching, governorate-based shipping, e-books, surveys, bundles/add-ons are named in the Stage 1 prompt as "may include" but are absent from the supplied UI → tracked as OPEN in `DECISIONS.md`.
