const STORAGE_KEY = "price-analyzer-watchlist";

export function getWatchlist() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function toggleWatchlist(productId) {
  const watchlist = getWatchlist();
  const next = watchlist.includes(productId)
    ? watchlist.filter((id) => id !== productId)
    : [...watchlist, productId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("watchlist-change"));
  return next.includes(productId);
}