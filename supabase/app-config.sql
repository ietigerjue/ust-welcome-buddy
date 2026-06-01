create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now(),
  constraint app_config_value_is_object check (jsonb_typeof(value) = 'object')
);

comment on table public.app_config is
  'Non-secret provider/model configuration for UST Buddy.';

comment on column public.app_config.key is
  'Config key such as chat_llm, metadata_llm, image_parser, or embedding.';

comment on column public.app_config.value is
  'JSON config containing provider, model, base_url_env, and api_key_env only. Do not store real API keys.';

create or replace function public.set_app_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_config_updated_at on public.app_config;

create trigger set_app_config_updated_at
before update on public.app_config
for each row
execute function public.set_app_config_updated_at();

