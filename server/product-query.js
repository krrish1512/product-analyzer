export const productSelect = `
  SELECT
    p.id,
    p.name,
    p.category,
    p.image_url AS image,
    EXISTS (
      SELECT 1
      FROM price_history external_history
      WHERE external_history.product_id = p.id
        AND external_history.source LIKE 'external:%'
    ) AS "isLive",
    best.price,
    best.original_price AS "originalPrice",
    best.store AS platform,
    CASE
      WHEN best.original_price > best.price
      THEN round((best.original_price - best.price) * 100.0 / best.original_price)::integer
      ELSE 0
    END AS discount,
    COALESCE(stats.lowest, best.price)::integer AS lowest,
    COALESCE(stats.highest, best.original_price, best.price)::integer AS highest,
    COALESCE(stats.average, best.price)::integer AS average,
    COALESCE(listing.prices, '[]'::json) AS prices,
    COALESCE(history.points, '[]'::json) AS history,
    COUNT(*) OVER()::integer AS total_count
  FROM products p
  JOIN LATERAL (
    SELECT store, price, original_price
    FROM offers
    WHERE product_id = p.id
    ORDER BY price ASC, store ASC
    LIMIT 1
  ) best ON true
  LEFT JOIN LATERAL (
    SELECT
      MIN(price) AS lowest,
      MAX(price) AS highest,
      round(AVG(price)) AS average
    FROM (
      SELECT price FROM price_history WHERE product_id = p.id
      UNION ALL
      SELECT price FROM offers WHERE product_id = p.id
    ) observations
  ) stats ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('platform', store, 'price', price, 'url', store_url) ORDER BY price, store) AS prices
    FROM offers
    WHERE product_id = p.id
  ) listing ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('date', to_char(points.observed_on, 'Mon DD'), 'price', points.price) ORDER BY points.observed_on) AS points
    FROM (
      SELECT observed_on, price
      FROM price_history
      WHERE product_id = p.id
      ORDER BY observed_on DESC
      LIMIT 30
    ) points
  ) history ON true
`;