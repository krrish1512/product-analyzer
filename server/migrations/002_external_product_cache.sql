CREATE TABLE IF NOT EXISTS external_product_cache (
  provider text NOT NULL,
  normalized_query text NOT NULL,
  request_query text NOT NULL,
  response_status integer NOT NULL DEFAULT 200,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 hours'),
  source_url text,
  PRIMARY KEY (provider, normalized_query)
);

CREATE INDEX IF NOT EXISTS external_product_cache_expires_idx
  ON external_product_cache (expires_at);
