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
import Analytics from './pages/Analytics/Analytics';
import MyListings from './pages/MyListings/MyListings';
import PersonalInfo from './pages/PersonalInfo/PersonalInfo';
import Security from './pages/Security/Security';
import HelpCenter from './pages/HelpCenter/HelpCenter';
import Pricing from './pages/Pricing/Pricing';
import Promote from './pages/Promote/Promote';
import Notifications from './pages/Notifications/Notifications';
import Saved from './pages/Saved/Saved';
import Category from './pages/Category/Category';
import ProductDetail from './pages/Product/ProductDetail';
import SellerProfile from './pages/Seller/SellerProfile';
import SearchResults from './pages/Search/SearchResults';
import BrandDetails from './pages/Brand/BrandDetails';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
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
            
            {/* Protected Routes */}
            <Route path="/publish" element={<ProtectedRoute><Publish /></ProtectedRoute>} />
            <Route path="/edit/:id" element={<ProtectedRoute><Publish /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:id" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/personal-info" element={<ProtectedRoute><PersonalInfo /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
            <Route path="/help" element={<HelpCenter />} /> {/* Help can be public */}
            <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
            <Route path="/promote/:id" element={<ProtectedRoute><Promote /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
            
            {/* Dynamic Discovery Routes (Public) */}
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
