-- Keep dashboard sales charts synchronized across active registers.
begin;

do $$
begin
  alter publication supabase_realtime add table public.sales;
exception
  when duplicate_object then null;
end $$;

commit;
