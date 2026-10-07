import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProductCard from "../../components/ProductCard/ProductCard";
import { categories } from "../../services/products";
import { getDataSources, listProducts, refreshCatalog } from "../../services/api";
import styles from "./Search.module.css";

const STORAGE_KEY = "pricewise-data-mode";
const PROVIDER_STORAGE_KEY = "pricewise-live-provider";

function Search() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "All");
  const [sort, setSort] = useState("featured");
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dataMode, setDataMode] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "demo");
  const [provider, setProvider] = useState(() => localStorage.getItem(PROVIDER_STORAGE_KEY) ?? "auto");
  const [availableProviders, setAvailableProviders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getDataSources({ signal: controller.signal })
      .then((result) => {
        const enabled = Array.isArray(result.enabledProviders) ? result.enabledProviders : [];
        setAvailableProviders(enabled);
        if (enabled.length && !enabled.includes(provider) && provider !== "auto") {
          setProvider("auto");
          localStorage.setItem(PROVIDER_STORAGE_KEY, "auto");
        }
      })
      .catch(() => {
        setAvailableProviders([]);
      });
    return () => controller.abort();
  }, [provider]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      listProducts({ query: search, category, sort, limit: 100 }, { signal: controller.signal })
        .then((result) => {
          setProducts(result.items);
          setTotal(result.total);
        })
        .catch((requestError) => {
          if (requestError.name !== "AbortError") setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [category, retry, search, sort]);

  useEffect(() => {
    if (dataMode !== "live") return;
    if (!availableProviders.length) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const activeCategory = category === "All" ? "" : category;
      setRefreshing(true);
      refreshCatalog({
        query: search.trim(),
        category: activeCategory,
        limit: 20,
        forceRefresh: true,
        provider,
      }, { signal: controller.signal })
        .then(() => {
          setRetry((value) => value + 1);
        })
        .catch((requestError) => {
          if (requestError.name !== "AbortError") setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setRefreshing(false);
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [availableProviders, category, dataMode, provider, search]);

  function updateCategory(value) {
    setCategory(value);
    const next = new URLSearchParams(params);
    if (value === "All") next.delete("category");
    else next.set("category", value);
    setParams(next, { replace: true });
  }

  function updateSearch(value) {
    setSearch(value);
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setSearch("");
    setCategory("All");
    setParams(new URLSearchParams(), { replace: true });
  }

  function handleDataModeChange(nextMode) {
    const nextValue = nextMode === "live" ? "live" : "demo";
    setDataMode(nextValue);
    localStorage.setItem(STORAGE_KEY, nextValue);
    if (nextValue === "live" && !availableProviders.length) {
      setError(true);
    }
  }

  const liveProviderOptions = [
    { value: "auto", label: "Auto" },
    ...availableProviders.map((item) => ({ value: item, label: item }))
  ];

  return (
    <main className={styles.searchPage}>
      <header className={styles.header}>
        <p className={styles.label}>PRICE EXPLORER</p>
        <h1>Find your next good buy.</h1>
        <p>Compare current listings and open a product to see its price details.</p>
      </header>

      <section className={styles.dataSourcePanel} aria-label="Catalog data source selection">
        <div>
          <p className={styles.dataLabel}>Catalog data</p>
          <h2>{dataMode === "live" ? "Live providers" : "Demo catalog"}</h2>
        </div>
        <div className={styles.dataControls}>
          <select value={dataMode} onChange={(event) => handleDataModeChange(event.target.value)} className={styles.select} aria-label="Choose data source">
            <option value="demo">Demo catalog</option>
            <option value="live" disabled={!availableProviders.length}>Live providers</option>
          </select>
          {dataMode === "live" && availableProviders.length > 0 && (
            <select value={provider} onChange={(event) => {
              const nextProvider = event.target.value;
              setProvider(nextProvider);
              localStorage.setItem(PROVIDER_STORAGE_KEY, nextProvider);
            }} className={styles.select} aria-label="Choose live data provider">
              {liveProviderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
          {refreshing && <span className={styles.refreshing}>Refreshing live catalog…</span>}
        </div>
      </section>

      <section className={styles.controls} aria-label="Filter products">
        <label className={styles.searchInput}>
          <span aria-hidden="true">⌕</span>
          <input type="search" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search products, stores, categories" aria-label="Search products" />
          {search && <button type="button" onClick={() => updateSearch("")} aria-label="Clear search">×</button>}
        </label>
        <select value={category} onChange={(event) => updateCategory(event.target.value)} className={styles.select} aria-label="Filter by category">
          <option value="All">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className={styles.select} aria-label="Sort products">
          <option value="featured">Sort: Featured</option>
          <option value="price-low">Price: Low to high</option>
          <option value="price-high">Price: High to low</option>
          <option value="discount">Biggest discount</option>
        </select>
      </section>

      <section className={styles.results}>
        <div className={styles.resultHeader}>
          <div><h2>{category === "All" ? "All products" : category}</h2><span>{total} {total === 1 ? "match" : "matches"}</span></div>
          {(search || category !== "All") && <button className={styles.clearFilters} type="button" onClick={clearFilters}>Clear filters</button>}
        </div>
        {error ? (
          <div className={styles.noResults}><h3>Could not load products</h3><p>Check that the API is running and try again.</p><button className={styles.clearFilters} type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
        ) : loading ? (
          <p className={styles.loading}>Loading products…</p>
        ) : products.length ? (
          <div className={styles.grid}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        ) : (
          <div className={styles.noResults}><span aria-hidden="true">⌕</span><h3>No products found</h3><p>Try a broader search or clear the selected filters.</p><Link to="/search">Show all products</Link></div>
        )}
      </section>
    </main>
  );
}

export default Search;