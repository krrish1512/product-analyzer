import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
import Home from "./pages/Home/Home";
import Search from "./pages/Search/Search";
import Product from "./pages/Product/Product";
import Watchlist from "./pages/Watchlist/Watchlist";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="appShell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      <footer className="pageFooter">Pricewise · Product prices shown are sample data for this frontend demo.</footer>
    </BrowserRouter>
  );
}

export default App;