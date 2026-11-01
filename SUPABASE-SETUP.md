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
