-- Enable pgvector extension for storing embeddings
create extension if not exists vector;

-- Stores chunked text from therapy documents with their embeddings
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1024),
  source text not null,  -- S3 key / filename that this chunk came from
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- IVFFlat index: approximate nearest-neighbor search (much faster than exact at scale).
-- lists = 100 is a good default for up to ~1M vectors; tune upward as data grows.
create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RLS: allow all for now (same pattern as chats/messages)
alter table public.document_chunks enable row level security;
create policy "Allow all on document_chunks"
  on public.document_chunks for all using (true) with check (true);

-- match_documents: cosine similarity search used by the chat API.
-- Returns chunks whose similarity to query_embedding exceeds match_threshold,
-- ordered by relevance, capped at match_count results.
create or replace function match_documents(
  query_embedding vector(1024),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  source text,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    source,
    1 - (embedding <=> query_embedding) as similarity
  from public.document_chunks
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
