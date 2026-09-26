import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../../components/ProductCard/ProductCard";
import { listProducts } from "../../services/api";
import { getWatchlist } from "../../services/watchlist";
import styles from "./Watchlist.module.css";

function Watchlist() {
  const [savedIds, setSavedIds] = useState(() => getWatchlist());
  const [products, setProducts] = useState([]);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listProducts({ limit: 100 }, { signal: controller.signal })
      .then((result) => setProducts(result.items))
      .catch((error) => {
        if (error.name !== "AbortError") setCatalogError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const update = () => setSavedIds(getWatchlist());
    window.addEventListener("watchlist-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("watchlist-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const savedProducts = products.filter((product) => savedIds.includes(product.id));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>YOUR PRICE DESK</p>
        <h1>Watchlist</h1>
        <p>Keep the products you care about close, and compare their latest listed prices.</p>
      </header>
      {catalogError ? (
        <section className={styles.empty}><h2>Could not load products</h2><p>Check that the API is running, then refresh this page.</p></section>
      ) : savedProducts.length ? (
        <section className={styles.grid} aria-label="Saved products">
          {savedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </section>
      ) : (
        <section className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">♡</span>
          <h2>Your watchlist is waiting</h2>
          <p>Save a product from its price details to keep it here.</p>
          <Link to="/search" className={styles.button}>Explore products</Link>
        </section>
      )}
    </main>
  );
}

export default Watchlist;