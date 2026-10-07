import { Link } from "react-router-dom";
import styles from "./ProductCard.module.css";

function getDirectOffer(product) {
  const offers = Array.isArray(product.prices) ? product.prices : [];
  return offers.find((offer) => {
    try {
      const url = new URL(offer.url);
      return (url.protocol === "https:" || url.protocol === "http:")
        && url.pathname !== "/"
        && !["google.com", "www.google.com", "example.com", "www.example.com"].includes(url.hostname);
    } catch {
      return false;
    }
  });
}

function ProductCard({ product }) {
  const directOffer = getDirectOffer(product);

  return (
    <div className={styles.card}>

      <div className={styles.imageContainer}>
        <img
          src={product.image}
          alt={product.name}
          className={styles.image}
        />

        {product.discount && (
          <span className={styles.discount}>
            {product.discount}% OFF
          </span>
        )}
      </div>

      <div className={styles.content}>

        <p className={styles.category}>
          {product.category}
        </p>

        <h3 className={styles.name}>
          {product.name}
        </h3>

        <div className={styles.priceRow}>

          <span className={styles.price}>
            ₹{product.price.toLocaleString("en-IN")}
          </span>

          {product.originalPrice && (
            <span className={styles.originalPrice}>
              ₹{product.originalPrice.toLocaleString("en-IN")}
            </span>
          )}

        </div>

        <div className={styles.platform}>
          <span>Available on</span>
          <strong>{product.platform}</strong>
        </div>

        <div className={styles.actions}>
          <Link to={`/product/${product.id}`} className={styles.button}>
            Compare prices <span aria-hidden="true">→</span>
          </Link>
          {directOffer && <a className={`${styles.button} ${styles.storeButton}`} href={directOffer.url} target="_blank" rel="noreferrer">
            View product at {directOffer.platform} <span aria-hidden="true">↗</span>
          </a>}
        </div>

      </div>

    </div>
  );
}

export default ProductCard;