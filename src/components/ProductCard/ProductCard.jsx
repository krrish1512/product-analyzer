import { Link } from "react-router-dom";
import styles from "./ProductCard.module.css";

function ProductCard({ product }) {
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

        <Link to={`/product/${product.id}`} className={styles.button}>
          Compare prices <span aria-hidden="true">→</span>
        </Link>

      </div>

    </div>
  );
}

export default ProductCard;