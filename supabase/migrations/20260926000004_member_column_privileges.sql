-- Members may only edit their own display name (never role or PIN fields),
-- and PIN hashes / lockout state are never readable through the API.

revoke update on public.household_members from authenticated, anon;
grant update (display_name) on public.household_members to authenticated;

revoke select on public.household_members from authenticated, anon;
grant select (household_id, user_id, role, display_name, created_at) on public.household_members to authenticated;

-- Devices: parents rename and revoke; nothing else.
revoke update on public.devices from authenticated, anon;
grant update (name, revoked_at) on public.devices to authenticated;
