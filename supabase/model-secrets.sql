create table if not exists model_secrets (
  key text primary key,
  encrypted_value text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz default now()
);

alter table model_secrets enable row level security;

create index if not exists model_secrets_updated_at_idx
  on model_secrets(updated_at desc);

comment on table model_secrets is
  'Server-side encrypted model provider secrets. Values are encrypted by the app server and must never be returned to the frontend.';
