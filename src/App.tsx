import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout/MainLayout';
import Home from './pages/Home/Home';
import { AuthProvider } from './context/AuthContext';
import { DiscoveryProvider } from './context/DiscoveryContext';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import Chat from './pages/Chat/Chat';
import Explore from './pages/Explore/Explore';
import Publish from './pages/Publish/Publish';
import Profile from './pages/Profile/Profile';
import Notifications from './pages/Notifications/Notifications';
import Saved from './pages/Saved/Saved';
import Category from './pages/Category/Category';
import ProductDetail from './pages/Product/ProductDetail';
import SellerProfile from './pages/Seller/SellerProfile';
import SearchResults from './pages/Search/SearchResults';
import BrandDetails from './pages/Brand/BrandDetails';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import './App.css';


function App() {
  return (
    <AuthProvider>
      <DiscoveryProvider>
        <Router>
        <ScrollToTop />
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Main App Routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/publish" element={<Publish />} />
            <Route path="/edit/:id" element={<Publish />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/saved" element={<Saved />} />
            
            {/* Dynamic routes */}
            <Route path="/category/:id" element={<Category />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/seller/:id" element={<SellerProfile />} />
            <Route path="/search/:query" element={<SearchResults />} />
            <Route path="/brand/:brandName" element={<BrandDetails />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Router>
      </DiscoveryProvider>
    </AuthProvider>
  );
}

export default App;
