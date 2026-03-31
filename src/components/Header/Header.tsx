import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  ChevronDown, 
  MapPin, 
  Heart, 
  MessageSquare, 
  Bell, 
  User,
  PanelLeftClose,
  PanelLeft,
  History,
  ArrowRight,
  Mail,
  ShieldCheck,
  Tag,
  Star,
  ShoppingBag,
  BellOff,
  CheckCheck,
  Trash2
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDiscovery } from '../../context/DiscoveryContext';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const LOCAL_SEARCH_KEY = '@local_search_history';
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const { selectedLocation, setDiscoveryLocation } = useDiscovery();

  // Load history on mount and when user changes
  useEffect(() => {
    fetchHistory();
    if (user) fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    setIsLoadingNotifs(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      setNotifications((data || []).filter(n => {
        if (n.type === 'listing_status' && n.payload?.status === 'pending') return false;
        return true;
      }));
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoadingNotifs(false);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'listing_status': return { icon: <ShoppingBag size={14} />, color: '#2563eb', bg: '#eff6ff' };
      case 'message': return { icon: <Mail size={14} />, color: '#f59e0b', bg: '#fffbeb' };
      case 'verification': return { icon: <ShieldCheck size={14} />, color: '#10b981', bg: '#ecfdf5' };
      case 'offer': return { icon: <Tag size={14} />, color: '#8b5cf6', bg: '#f5f3ff' };
      case 'review_request': return { icon: <Star size={14} />, color: '#f59e0b', bg: '#fffbeb' };
      default: return { icon: <Bell size={14} />, color: '#64748b', bg: '#f1f5f9' };
    }
  };

  const markNotifAsRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (!error) setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllNotifsRead = async () => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id).eq('is_read', false);
    if (!error) setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotif = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const fetchHistory = async () => {
    try {
      if (user) {
        // Fetch from Supabase (matching original app's lib/tracking.ts)
        const { data, error } = await supabase
          .from('search_history')
          .select('query')
          .eq('user_id', user.id)
          .order('searched_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setSearchHistory((data || []).map((r: any) => r.query));
      } else {
        // Fetch from localStorage using original app's key
        const saved = localStorage.getItem(LOCAL_SEARCH_KEY);
        if (saved) setSearchHistory(JSON.parse(saved).slice(0, 5));
      }
    } catch (e) {
      console.error('History fetch error:', e);
      setSearchHistory([]);
    }
  };

  const saveSearchToHistory = async (query: string) => {
    if (!query.trim()) return;
    const q = query.trim();

    try {
      if (user) {
        // Save to Supabase (matching original app's upsert logic)
        await supabase
          .from('search_history')
          .upsert({ user_id: user.id, query: q, searched_at: new Date().toISOString() },
            { onConflict: 'user_id,query' });
      } else {
        // Save to localStorage
        const local = localStorage.getItem(LOCAL_SEARCH_KEY);
        let history = local ? JSON.parse(local) : [];
        history = [q, ...history.filter((h: string) => h !== q)].slice(0, 20);
        localStorage.setItem(LOCAL_SEARCH_KEY, JSON.stringify(history));
      }
      fetchHistory(); // Refresh
    } catch (e) {
      console.error('History save error:', e);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchValue.trim()) {
      saveSearchToHistory(searchValue);
      navigate(`/search/${searchValue.trim()}`);
      setIsSearchFocused(false);
    }
  };

  const handleHistoryClick = (query: string) => {
    setSearchValue(query);
    navigate(`/search/${query}`);
    setIsSearchFocused(false);
    saveSearchToHistory(query);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        <div className="header-location" onClick={() => setIsLocModalOpen(true)}>
          <MapPin size={16} className="location-icon" />
          <span className="location-text">
            {selectedLocation ? selectedLocation.name : 'Accra, Greater Accra Region'}
          </span>
          <ChevronDown size={14} className="chevron-icon" />
        </div>
      </div>

      <div className="header-center">
        <form className="header-search-container" ref={searchRef} onSubmit={handleSearchSubmit}>
          <Search className="header-search-icon" size={16} />
          <input 
            type="text" 
            className={`header-search-input ${isSearchFocused ? 'focused' : ''}`} 
            placeholder="Search products" 
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
          />

          {/* History Dropdown - Appears on focus */}
          {isSearchFocused && searchHistory.length > 0 && (
            <div className="search-dropdown" ref={dropdownRef}>
              <div className="dropdown-header">
                <History size={14} />
                <span>Recent History</span>
              </div>
              <div className="dropdown-items">
                {searchHistory.map((query, index) => (
                  <div key={index} className="dropdown-item" onClick={() => handleHistoryClick(query)}>
                    <span className="item-icon"><Search size={14} /></span>
                    <span className="item-text">{query}</span>
                    <ArrowRight size={14} className="item-arrow" />
                  </div>
                ))}
              </div>
              <div className="dropdown-footer">
                <span onClick={async () => {
                  try {
                    if (user) {
                      await supabase.from('search_history').delete().eq('user_id', user.id);
                    } else {
                      localStorage.removeItem(LOCAL_SEARCH_KEY);
                    }
                    setSearchHistory([]);
                  } catch (e) {
                    console.error('History clear error:', e);
                  }
                }}>Clear search history</span>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Right: Actions */}
      <div className="header-right">
        <button className="icon-action-btn" onClick={() => navigate('/saved')}>
          <Heart size={20} />
        </button>
        <button className="icon-action-btn" onClick={() => navigate('/chat')}>
          <MessageSquare size={20} />
        </button>
        <div className="notifications-wrap" ref={notificationsRef}>
          <button 
            className={`icon-action-btn ${showNotifications ? 'active' : ''}`} 
            onClick={() => {
              if (window.innerWidth < 768) {
                navigate('/notifications');
              } else {
                setShowNotifications(!showNotifications);
                setIsSearchFocused(false);
              }
            }}
          >
            <Bell size={20} />
            {notifications.some(n => !n.is_read) && <div className="notif-badge" />}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="dropdown-header">
                <h3>Notifications</h3>
                <div className="header-actions">
                  <button onClick={markAllNotifsRead} title="Mark all as read"><CheckCheck size={14} /></button>
                  <button onClick={() => setNotifications([])} title="Clear all"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="notif-list">
                {isLoadingNotifs ? (
                  <div className="notif-loading">Refreshing alerts...</div>
                ) : notifications.length === 0 ? (
                  <div className="notif-empty">
                    <BellOff size={24} color="#e2e8f0" />
                    <p>All caught up!</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const icon = getNotifIcon(n.type);
                    return (
                      <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`} onClick={() => markNotifAsRead(n.id)}>
                        <div className="notif-icon" style={{ background: icon.bg, color: icon.color }}>
                          {icon.icon}
                        </div>
                        <div className="notif-content">
                          <h4>{n.title}</h4>
                          <p>{n.message}</p>
                          <span className="notif-time">{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <button className="delete-notif" onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        <button className="icon-action-btn" onClick={() => navigate('/profile')}>
          <User size={20} />
        </button>
      </div>

      <LocationModal 
        isOpen={isLocModalOpen} 
        onClose={() => setIsLocModalOpen(false)}
        onSelect={(loc) => {
          setDiscoveryLocation(loc);
          console.log('Global location updated:', loc);
        }}
      />
    </header>
  );
};

export default Header;
