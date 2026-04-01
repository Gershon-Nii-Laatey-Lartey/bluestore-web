import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Plus, MessageCircle, User } from 'lucide-react';
import './MobileNavbar.css';

const MobileNavbar: React.FC = () => {

  return (
    <nav className="mobile-navbar">
      <NavLink to="/" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <Home size={20} />
        <span>Home</span>
      </NavLink>
      
      <NavLink to="/explore" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <Compass size={20} />
        <span>Explore</span>
      </NavLink>
      
      <NavLink to="/publish" className="mobile-nav-item publish-center">
        <div className="publish-square">
          <Plus size={18} />
        </div>
        <span>Publish</span>
      </NavLink>
      
      <NavLink to="/chat" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <MessageCircle size={20} />
        <span>Chat</span>
      </NavLink>
      
      <NavLink to="/profile" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
        <User size={20} />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};

export default MobileNavbar;
