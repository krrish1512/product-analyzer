import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PriceChart from "../../components/PriceChart/PriceChart";
import { getProduct } from "../../services/api";
import { getWatchlist, toggleWatchlist } from "../../services/watchlist";
import styles from "./Product.module.css";

function formatPrice(price) {
  return `₹${price.toLocaleString("en-IN")}`;
}

function Product() {
  const { id } = useParams();
  const [details, setDetails] = useState({ id: null, product: null, error: "" });
  const product = details.id === id ? details.product : null;
  const productId = product?.id;
  const [saved, setSaved] = useState(() => productId ? getWatchlist().includes(productId) : false);

  useEffect(() => {
    const controller = new AbortController();
    getProduct(id, { signal: controller.signal })
      .then((loadedProduct) => {
        setDetails({ id, product: loadedProduct, error: "" });
        setSaved(getWatchlist().includes(loadedProduct.id));
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDetails({ id, product: null, error: error.message });
      });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const updateSaved = () => setSaved(productId ? getWatchlist().includes(productId) : false);
    window.addEventListener("watchlist-change", updateSaved);
    window.addEventListener("storage", updateSaved);
    return () => {
      window.removeEventListener("watchlist-change", updateSaved);
      window.removeEventListener("storage", updateSaved);
    };
  }, [productId]);

  if (!product) {
    const loading = details.id !== id;
    const message = loading ? "Loading product details…" : details.error || "Product not found.";
    return <main className={styles.notFound}><h1>{loading ? "Loading product" : "Product unavailable"}</h1><p>{message}</p>{!loading && <Link to="/search">Browse products</Link>}</main>;
  }

  function handleWatchlist() {
    setSaved(toggleWatchlist(product.id));
  }

  return (
    <main className={styles.productPage}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/search">Products</Link><span>/</span><span>{product.name}</span></nav>
      <section className={styles.productInfo}>
        <div className={styles.imageSection}><img src={product.image} alt={product.name} className={styles.productImage} /></div>
        <div className={styles.details}>
          <p className={styles.category}>{product.category}</p>
          <h1>{product.name}</h1>
          <p className={styles.description}>Compare current listings and review the sample price range before you decide when to buy.</p>
          <div className={styles.currentPrice}><strong>{formatPrice(product.price)}</strong><span>best listed price</span>{product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}</div>
          <div className={styles.stats}>
            <div className={styles.stat}><span>Lowest seen</span><strong>{formatPrice(product.lowest)}</strong></div>
            <div className={styles.stat}><span>Highest seen</span><strong>{formatPrice(product.highest)}</strong></div>
            <div className={styles.stat}><span>Average</span><strong>{formatPrice(product.average)}</strong></div>
          </div>
          <button type="button" className={`${styles.watchButton} ${saved ? styles.saved : ""}`} onClick={handleWatchlist} aria-pressed={saved}><span aria-hidden="true">{saved ? "♥" : "♡"}</span>{saved ? "Saved to watchlist" : "Add to watchlist"}</button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p>COMPARE STORES</p><h2>Current listings</h2></div><span>Sample prices · India</span></div>
        <div className={styles.priceTable}>
          {product.prices.map((store) => <div className={styles.store} key={store.platform}>
            <div className={styles.storeName}><div className={styles.storeIcon}>{store.platform.slice(0, 1)}</div><div><strong>{store.platform}</strong><span>Listed price</span></div></div>
            <strong className={styles.storePrice}>{formatPrice(store.price)}</strong>
            <a className={styles.storeButton} href={store.url} target="_blank" rel="noreferrer">Visit store <span aria-hidden="true">↗</span></a>
          </div>)}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p>PRICE HISTORY</p><h2>How the price moves</h2></div><span>{product.history.length} stored observations</span></div>
        <PriceChart price={product.price} history={product.history} />
      </section>
    </main>
  );
}

export default Product;