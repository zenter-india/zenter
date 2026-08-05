-- Push notifications (mobile): closes the RLS gap on device_tokens and
-- notifications (both were live with RLS disabled — anon-exposed), and adds
-- the FK device_tokens.user_id was missing. Both tables are currently empty
-- and unused, so this is a pure exposure fix, not a behavior change.

alter table public.device_tokens
  add constraint device_tokens_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.device_tokens enable row level security;

create policy device_tokens_rw on public.device_tokens
  for all to authenticated
  using (user_id = public.current_app_uid())
  with check (user_id = public.current_app_uid());

revoke all on public.device_tokens from anon;
grant select, insert, update, delete on public.device_tokens to authenticated;

alter table public.notifications enable row level security;

create policy notifications_rw on public.notifications
  for all to authenticated
  using (user_id = public.current_app_uid())
  with check (user_id = public.current_app_uid());

revoke all on public.notifications from anon;
grant select, insert, update, delete on public.notifications to authenticated;
