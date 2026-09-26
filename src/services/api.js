async function request(path, signal) {
  const response = await fetch(path, {
    signal,
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status}).`);
  }
  return body;
}

export function listProducts({ query = "", category = "", sort = "featured", limit = 50, offset = 0 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ sort, limit: String(limit), offset: String(offset) });
  if (query.trim()) params.set("q", query.trim());
  if (category && category !== "All") params.set("category", category);
  return request(`/api/products?${params}`, signal);
}

export function getProduct(id, { signal } = {}) {
  return request(`/api/products/${encodeURIComponent(id)}`, signal);
}