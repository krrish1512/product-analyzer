async function request(path, signal, options = {}) {
  const response = await fetch(path, {
    ...options,
    signal,
    headers: {
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
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

export function getDataSources({ signal } = {}) {
  return request("/api/data-sources", signal);
}

export function refreshCatalog({ query = "", category = "", limit = 12, forceRefresh = true, provider = "auto" } = {}, { signal } = {}) {
  return request("/api/catalog/refresh", signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, category, limit, forceRefresh, provider }),
  });
}