import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Plus, 
  MessageCircle, 
  Car, 
  BookOpen, 
  Building2, 
  Smartphone, 
  Shirt, 
  Heart, 
  Home, 
  PawPrint,
  User,
  Compass,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import './Sidebar.css';

const categories = [
  { label: 'Automotive', icon: Car, path: '/category/automotive' },
  { label: 'Books & Media', icon: BookOpen, path: '/category/books-media' },
  { label: 'Business & Industrial', icon: Building2, path: '/category/business-industrial' },
  { label: 'Electronics', icon: Smartphone, path: '/category/electronics' },
  { label: 'Fashion & Beauty', icon: Shirt, path: '/category/fashion-beauty' },
  { label: 'Health & Wellness', icon: Heart, path: '/category/health-wellness' },
  { label: 'Home & Garden', icon: Home, path: '/category/home-garden' },
  { label: 'Pets & Animals', icon: PawPrint, path: '/category/pets-animals' },
  { label: 'Sports & Outdoors', icon: Car, path: '/category/sports-outdoors' },
  { label: 'Toys & Games', icon: PawPrint, path: '/category/toys-games' },
  { label: 'Food & Beverages', icon: Shirt, path: '/category/food-beverages' },
];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { user } = useAuth();
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-scroll-content">
        {/* Dashboard */}
        <NavLink 
          to="/" 
          className={({ isActive }) => `nav-item dashboard ${isActive ? 'active' : ''}`}
          title={isCollapsed ? "Home" : ""}
        >
          <Home size={18} className="nav-item-icon" />
          {!isCollapsed && <span className="nav-item-label">Home</span>}
        </NavLink>

        {/* Explore - REMOVED */}

        {/* Publish Ad */}
        <NavLink 
          to="/publish" 
          className={({ isActive }) => `nav-item publish-ad ${isActive ? 'active' : ''}`}
          title={isCollapsed ? "Publish Ad" : ""}
        >
          <Plus size={18} className="nav-item-icon" />
          {!isCollapsed && <span className="nav-item-label">Publish Ad</span>}
        </NavLink>

        {/* Messages */}
        <NavLink 
          to="/chat" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title={isCollapsed ? "Messages" : ""}
        >
          <MessageCircle size={18} className="nav-item-icon" />
          {!isCollapsed && <span className="nav-item-label">Messages</span>}
        </NavLink>

        {/* Saved */}
        <NavLink 
          to="/saved" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title={isCollapsed ? "Saved Items" : ""}
        >
          <Heart size={18} className="nav-item-icon" />
          {!isCollapsed && <span className="nav-item-label">Saved Items</span>}
        </NavLink>

        {/* Category Items */}
        <div className="categories-nav">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <NavLink 
                key={idx} 
                to={cat.path}
                className={({ isActive }) => `nav-item category-item ${isActive ? 'active' : ''}`}
                title={isCollapsed ? cat.label : ""}
              >
                <Icon size={18} className="nav-item-icon" />
                {!isCollapsed && <span className="nav-item-label">{cat.label}</span>}
                {!isCollapsed && <ChevronRight size={14} className="chevron-icon" />}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Footer: User Profile */}
      <NavLink to={user ? "/profile" : "/login"} className="profile-section" style={{ textDecoration: 'none' }}>
        <div className="profile-card">
          <div className="avatar-placeholder">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="sidebar-avatar-img" />
            ) : (
              <User size={22} />
            )}
          </div>
          <div className="profile-info">
            {!isCollapsed && (
              <>
                <h3 className="profile-name">
                  {profile?.full_name || user?.email?.split('@')[0] || 'My Profile'}
                </h3>
                <p className="profile-email">
                  {profile?.phone_number || user?.email || 'Access your account'}
                </p>
              </>
            )}
          </div>
        </div>
      </NavLink>
    </aside>
  );
};

export default Sidebar;
