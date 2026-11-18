# Dress Dreams by Nihara — Supabase-connected website

## What this build connects
- Public storefront reads active categories, products and size/colour stock from Supabase.
- Admin login uses Supabase Auth and checks membership in `public.admin_users`.
- Admin can create/delete categories and create/edit/delete products and variants.
- Product images upload to the `product-images` Storage bucket.
- Product data and images are shared across customer devices.

## 1. Add your publishable key
Open `supabase-config.js`. The Project URL is already filled in. Replace `PASTE_YOUR_SB_PUBLISHABLE_KEY_HERE` with the full `sb_publishable_...` key from Supabase → Project Settings → API Keys. Do not use an `sb_secret_...` key or database password.

## 2. Apply the admin read policy patch
In Supabase → SQL Editor → New query, paste and run the contents of `SUPABASE-ADMIN-POLICY-PATCH.sql`. This is required because the website must check the signed-in user's own row in `admin_users`; it does not expose other admin rows.

## 3. Confirm your admin membership
Your earlier SQL inserted your Auth user UUID into `public.admin_users`. Do not insert it again unless it is missing. In Table Editor → `admin_users`, confirm the row exists.

## 4. Deploy to Vercel
Extract this ZIP. Upload the CONTENTS of `DRESS-DREAM-BY-NIHARA-main` to the root of your GitHub repository, replacing the old files. Keep the `assets` folder. Commit the changes and wait for Vercel to deploy.

## 5. Test
- Store: `https://dressdreambynihara.vercel.app/`
- Admin sign-in: `https://dressdreambynihara.vercel.app/admin-login.html`
- Admin inventory: after signing in, `admin.html` opens.

## Important before launch
This build connects the catalogue, categories, variants and image storage. Checkout is intentionally not enabled for real payments. Customer orders, secure payment gateway verification, server-side stock reservation/decrement, PIN-code shipping calculation, returns/exchanges and email notifications still need a secure backend workflow. Do not accept real orders or payments until those are implemented and tested.

## Database schema expected
This build expects the tables and columns created in the setup steps: `categories(id,name,slug,is_active)`, `products(id,category_id,name,description,price,images,is_active,created_at)`, `product_variants(id,product_id,colour,size,stock)`, and `admin_users(user_id)`. It uses the existing `public.is_store_admin()` function for storage policies.


## Manual UPI checkout (current limited setup)
The storefront now displays the store owner's supplied personal Google Pay QR code and UPI ID at checkout. Customers must enter the exact cart amount in their UPI app, then submit their name, phone number and UPI transaction reference. The website now inserts the customer's order directly into the `store_orders` table in Supabase. No email app is opened.

Orders are stored in Supabase and appear in the admin dashboard. Payment verification remains manual: the store owner must verify the actual bank credit before marking an order as paid. This setup does not automatically verify a payment, reserve/decrement stock, or send customer confirmation emails. The QR is a static personal UPI QR; customers may see the personal account holder name in their UPI app. UPI payments only are supported by this flow; cards and net banking are not.

The UPI QR image is stored at `assets/dress-dreams-upi-qr.png`. The UPI ID is configured in `script.js`. Do not publish this setup unless you are comfortable making the personal UPI details public.


## 7. Enable website order submission and admin order management
1. In Supabase → SQL Editor → New query, paste and run `SUPABASE-ORDERS-SETUP.sql`.
2. This creates `public.store_orders`, enables row-level security, allows customers to submit orders without reading other customers' orders, and allows signed-in store admins to view/update orders.
3. Deploy the updated `script.js`, `admin.js`, and `admin.html` files to Vercel.
4. Open `admin.html` while signed in. New orders appear in **Customer orders**; the dashboard subscribes to new-order updates (Realtime must be enabled for the table).
5. Verify each UPI credit in the bank account before setting Payment to **Verified**. Never rely on the customer's UTR alone.

Customer submissions are not payment proof. New orders are always forced by a database trigger to `pending_verification` and `new`, regardless of values sent by the browser.


## Customer account page
- Customer account page: `account.html` (email/password registration and sign-in, plus mobile OTP sign-in).
- Email confirmation behaviour follows Supabase Authentication settings.
- To use mobile OTP, configure an SMS provider in Supabase Dashboard → Authentication → Providers → Phone, and enable Phone authentication. SMS delivery may incur provider charges.
- The account page is currently optional and does not yet require sign-in to submit a guest order or attach existing orders to a customer profile. Do not describe guest orders as account-linked until that workflow is added.

## Admin order filters
- Customer orders can be searched and filtered by payment status and order status. Search and both filters work together; Clear Filters resets them.
