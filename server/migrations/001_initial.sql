CREATE TABLE products (
  id integer PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offers (
  id bigserial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store text NOT NULL,
  price integer NOT NULL CHECK (price > 0),
  original_price integer CHECK (original_price IS NULL OR original_price > 0),
  store_url text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, store)
);

CREATE TABLE price_history (
  id bigserial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price integer NOT NULL CHECK (price > 0),
  observed_on date NOT NULL,
  source text NOT NULL DEFAULT 'seed',
  UNIQUE (product_id, observed_on, source)
);

CREATE INDEX products_category_idx ON products (lower(category));
CREATE INDEX offers_product_price_idx ON offers (product_id, price);
CREATE INDEX price_history_product_date_idx ON price_history (product_id, observed_on DESC);