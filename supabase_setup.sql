-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create the screenshots table
create table if not exists screenshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  image_url text not null,
  summary text,
  tags text[],
  embedding vector(768), -- text-embedding-004 uses 768 dimensions by default. Change to 1536 if using OpenAI text-embedding-3-small.
  created_at timestamp with time zone default now()
);

-- Enable RLS (Row Level Security)
alter table screenshots enable row level security;

-- Create policy to allow users to see only their own screenshots
create policy "Users can view their own screenshots"
  on screenshots for select
  using (auth.uid() = user_id);

-- Create policy to allow users to insert their own screenshots
create policy "Users can insert their own screenshots"
  on screenshots for insert
  with check (auth.uid() = user_id);

-- Create a function to match screenshots using vector similarity
create or replace function match_screenshots (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  image_url text,
  summary text,
  tags text[],
  created_at timestamp with time zone,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    screenshots.id,
    screenshots.image_url,
    screenshots.summary,
    screenshots.tags,
    screenshots.created_at,
    1 - (screenshots.embedding <=> query_embedding) as similarity
  from screenshots
  where screenshots.user_id = p_user_id
    and 1 - (screenshots.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
