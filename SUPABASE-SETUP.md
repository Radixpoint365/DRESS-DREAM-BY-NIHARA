# Dress Dreams by Nihara — Admin login setup

This build adds a Supabase-backed admin sign-in gate. It will remain disabled until you configure Supabase.

## 1. Create Supabase project
Create a project at https://supabase.com/. In Project Settings → API, copy the Project URL and the **anon/public** key. Put them in `supabase-config.js`. Never put a `service_role` key in website files.

## 2. Create admin role table
Run this in Supabase → SQL Editor:

```sql
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
create policy "Admins can read their own admin role"
on public.admin_users for select to authenticated
using (auth.uid() = user_id);
```

## 3. Create your admin account
In Supabase → Authentication → Users, add your admin email and a strong password. Copy the user's UUID, then run (replace the UUID):

```sql
insert into public.admin_users (user_id) values ('PASTE-ADMIN-USER-UUID-HERE');
```

## 4. Deploy
Upload all files and the `assets` folder from this project to the root of your GitHub repository, replacing old files, then commit. Vercel redeploys automatically.

## 5. Admin page
Open `/admin-login.html`, or click Admin in the store footer.

## Important limitation
This update protects access to the existing admin prototype using Supabase Auth and an admin role check. Products and photos are **still stored in browser localStorage**, not a shared database, so changes are not yet visible to customers on other devices. The next stage must migrate products, categories, image storage, orders and stock to Supabase with Row Level Security and server-side payment verification. Do not treat this prototype as ready to accept live orders.
