-- The logos bucket is public (logos show in videos and the app), so only allow normal picture files up to 5 MB.
-- Without this, someone could upload any file of any size there and have it served from our Supabase address.
-- SVG is left out on purpose: an SVG file can contain code.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    file_size_limit = 5242880
where id = 'business-logos';

-- Discount codes are only ever checked by the server, so nobody signed in needs to read the list
drop policy if exists "Authenticated users can read active discount codes" on public.discount_codes;
