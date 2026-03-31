import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Bell, 
  User,
  PanelLeftClose,
  PanelLeft,
  History,
  ArrowRight,
  BellOff,
  Mail,
  ShieldCheck,
  Tag,
  Star,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LocationModal from '../LocationModal/LocationModal';
import './Header.css';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, isSidebarCollapsed }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [location, setLocation] = useState('Accra, Ghana');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search implementation
  };

  return (
    <header className="header">
      {/* Left: Sidebar Toggle, Brand, and Location */}
      <div className="header-left">
        <button className={`icon-action-btn side-toggle ${isSidebarCollapsed ? 'collapsed' : ''}`} onClick={onToggleSidebar}>
          {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <Link to="/" className="header-brand">
          <span className="brand-text">BlueStore</span>
        </Link>
        
        <div className="location-trigger" onClick={() => setIsLocModalOpen(true)}>
          <MapPin size={16} />
          <span className="loc-text">{location}</span>
        </div>
      </div>

      {/* Center: Search Hub */}
      <div className="header-center">
        <form 
          ref={searchRef}
          className={`search-orchestrator ${isSearchFocused ? 'focused' : ''}`} 
          onSubmit={handleSearch}
        >
          <div className="search-input-rail">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              placeholder="Search in Ghana..." 
              onFocus={() => setIsSearchFocused(true)}
            />
            <button type="submit" className="search-submit-btn">Search</button>
          </div>

          {isSearchFocused && (
            <div className="search-dropdown-rail">
              <div className="dropdown-section">
                <div className="section-header">
                  <History size={14} />
                  <span>Recent Searches</span>
                </div>
                <div className="recent-list">
                  <div className="recent-item">
                    <span>iPhone 15 Pro Max</span>
                    <ArrowRight size={14} className="item-arrow" />
                  </div>
                  <div className="recent-item">
                    <span>Toyota Camry 2022</span>
                    <ArrowRight size={14} className="item-arrow" />
                  </div>
                </div>
              </div>

              <div className="dropdown-section">
                <div className="section-header">
                  <Tag size={14} />
                  <span>Trending Categories</span>
                </div>
                <div className="trending-chips">
                  <span className="trend-chip">Electronics</span>
                  <span className="trend-chip">Vehicles</span>
                  <span className="trend-chip">Real Estate</span>
                  <span className="trend-chip">Jobs</span>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Right: Actions */}
      <div className="header-right">
        <div className="action-stack">
          <button className="icon-action-btn" title="Saved Items">
            <Star size={20} />
          </button>
          
          <div className="notification-trigger">
            <button className="icon-action-btn">
              <Bell size={20} />
              <span className="notification-badge" />
            </button>
            
            <div className="notification-dropdown">
                <div className="notif-header">
                    <h3>Notifications</h3>
                    <button className="mark-read">Mark all as read</button>
                </div>
                <div className="notif-list">
                    <div className="notif-empty">
                        <BellOff size={24} color="#e2e8f0" />
                        <p>No new notifications</p>
                    </div>
                </div>
            </div>
          </div>

          <button className="icon-action-btn" onClick={() => navigate('/chat')} title="Messages">
            <Mail size={20} />
          </button>
        </div>

        <div className="user-hub">
          {user ? (
            <Link to="/profile" className="user-profile-trigger">
              <div className="avatar-shimmer">
                <User size={20} />
              </div>
              <div className="user-meta-header">
                <span className="user-name-header">{user.email?.split('@')[0]}</span>
                <div className="verified-badge-mini">
                  <ShieldCheck size={10} />
                  <span>Verified</span>
                </div>
              </div>
            </Link>
          ) : (
            <button className="auth-btn-primary" onClick={() => navigate('/login')}>
              Login
            </button>
          )}
          
          <button className="sell-btn-header" onClick={() => navigate('/publish')}>
            <ShoppingBag size={18} />
            <span>Sell Now</span>
          </button>
        </div>
      </div>

      <LocationModal 
        isOpen={isLocModalOpen} 
        onClose={() => setIsLocModalOpen(false)}
        onSelect={(loc) => setLocation(loc.name)}
      />
    </header>
  );
};

export default Header;
