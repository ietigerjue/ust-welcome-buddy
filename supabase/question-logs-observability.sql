alter table question_logs
  add column if not exists retrieval_mode text;

alter table question_logs
  add column if not exists context_chunks_count integer;

alter table question_logs
  add column if not exists model_provider text;

alter table question_logs
  add column if not exists model_name text;

alter table question_logs
  add column if not exists estimated_input_tokens integer;

alter table question_logs
  add column if not exists estimated_output_tokens integer;

alter table question_logs
  add column if not exists latency_ms integer;

