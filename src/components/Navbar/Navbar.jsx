import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { getWatchlist } from "../../services/watchlist";
import styles from "./Navbar.module.css";

function Navbar() {
  const [watchCount, setWatchCount] = useState(() => getWatchlist().length);

  useEffect(() => {
    const updateCount = () => setWatchCount(getWatchlist().length);
    window.addEventListener("watchlist-change", updateCount);
    window.addEventListener("storage", updateCount);
    return () => {
      window.removeEventListener("watchlist-change", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, []);

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo} aria-label="Pricewise home">
          <span className={styles.logoMark}>P</span>
          <span>pricewise</span>
        </Link>
        <div className={styles.links}>
          <NavLink to="/" end className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>Overview</NavLink>
          <NavLink to="/search" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>Explore prices</NavLink>
          <NavLink to="/watchlist" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>
            Watchlist{watchCount > 0 && <span className={styles.count}>{watchCount}</span>}
          </NavLink>
        </div>
        <Link to="/search" className={styles.searchButton}>
          <span aria-hidden="true">⌕</span> Find a product
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;