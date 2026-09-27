import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
import "./App.css";

const Home = lazy(() => import("./pages/Home/Home"));
const Search = lazy(() => import("./pages/Search/Search"));
const Product = lazy(() => import("./pages/Product/Product"));
const Watchlist = lazy(() => import("./pages/Watchlist/Watchlist"));

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="appShell">
        <Suspense fallback={<main className="pageLoading" aria-live="polite">Loading Pricewise…</main>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/product/:id" element={<Product />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </div>
      <footer className="pageFooter">Pricewise · Product prices shown are sample data for this frontend demo.</footer>
    </BrowserRouter>
  );
}

export default App;