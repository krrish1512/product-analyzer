import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "../../components/ProductCard/ProductCard";
import { listProducts } from "../../services/api";
import styles from "./Home.module.css";

function Home() {
  const [query, setQuery] = useState("");
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [catalogError, setCatalogError] = useState(false);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    listProducts({ limit: 4 }, { signal: controller.signal })
      .then((result) => {
        setFeaturedProducts(result.items);
        setCatalogError(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setCatalogError(true);
      });
    return () => controller.abort();
  }, [retry]);

  function handleSearch(event) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.badge}><span /> SMARTER BUYING STARTS HERE</p>
            <h1>Know the price.<br /><span>Choose your moment.</span></h1>
            <p className={styles.heroText}>Compare prices across trusted stores, see the price story behind every deal, and keep an eye on the things you want.</p>
            <form className={styles.searchBox} onSubmit={handleSearch}>
              <span className={styles.searchIcon} aria-hidden="true">⌕</span>
              <input aria-label="Search products" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product or category" />
              <button type="submit">Search prices <span aria-hidden="true">→</span></button>
            </form>
            <p className={styles.searchHint}>Popular: <button type="button" onClick={() => { setQuery("iPhone"); navigate("/search?q=iPhone"); }}>iPhone</button><span>·</span><button type="button" onClick={() => { setQuery("headphones"); navigate("/search?q=headphones"); }}>headphones</button><span>·</span><button type="button" onClick={() => { setQuery("coffee"); navigate("/search?q=coffee"); }}>coffee</button></p>
          </div>
          <div className={styles.heroVisual} aria-label="Featured deal: Sony headphones">
            <img src="https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=900&auto=format&fit=crop&q=85" alt="Wireless over-ear headphones" />
            <div className={styles.dealNote}><span>PRICE DROP</span><strong>29% less</strong><small>Sony WH-1000XM5</small></div>
            <div className={styles.visualStamp}>PRICE<br />WISE</div>
          </div>
        </div>
      </section>

      <section className={styles.categorySection}>
        <div className={styles.sectionHeader}>
          <div><p>START WITH WHAT YOU NEED</p><h2>Browse by category</h2></div>
          <Link to="/search">All products <span aria-hidden="true">→</span></Link>
        </div>
        <div className={styles.categories}>
          {[
            { name: "Electronics", icon: "◉", detail: "Phones and essentials", count: "02" },
            { name: "Audio", icon: "♫", detail: "Sound worth comparing", count: "02" },
            { name: "Computers", icon: "▱", detail: "Work and play, for less", count: "01" },
            { name: "Groceries", icon: "✳", detail: "Everyday prices, checked", count: "01" },
          ].map((category) => <Link key={category.name} to={`/search?category=${encodeURIComponent(category.name)}`} className={styles.categoryCard}><span className={styles.categoryIcon}>{category.icon}</span><span className={styles.categoryText}><strong>{category.name}</strong><small>{category.detail}</small></span><span className={styles.categoryCount}>{category.count}</span></Link>)}
        </div>
      </section>

      <section className={styles.featured}>
        <div className={styles.sectionHeader}>
          <div><p>HAND-PICKED FOR YOUR SHORTLIST</p><h2>Worth a closer look</h2></div>
          <Link to="/search">Compare all <span aria-hidden="true">→</span></Link>
        </div>
        {catalogError ? <div className={styles.catalogMessage}><p>Product listings could not be loaded.</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : featuredProducts.length ? <div className={styles.productGrid}>{featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className={styles.catalogMessage}>Loading product listings…</p>}
      </section>
    </main>
  );
}

export default Home;