-- Profile photos. Run once in the Supabase SQL editor; safe to re-run.
-- A public bucket named "avatars": each person's photo is one small JPEG named after their account id (not guessable), at most 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];
