import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
    LogOut, 
    ShieldCheck, 
    Star, 
    Bell, 
    MapPin,
    ArrowRight,
    ShoppingBag,
    Settings,
    MessageCircle,
    Heart
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../../components/ProductCard/ProductCard';
import './Profile.css';

const Profile: React.FC = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) fetchProfileData();
    }, [user]);

    const fetchProfileData = async () => {
        setIsLoading(true);
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user?.id)
                .single();
            setProfile(profileData);

            const { data: listingsData } = await supabase
                .from('listings')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });
            setListings(listingsData || []);
        } catch (err) {
            console.error('Error fetching profile data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const stats = [
        { label: 'Active Deals', value: listings.length, icon: <ShoppingBag size={18} />, trend: 'Primary' },
        { label: 'Platform Trust', value: '98%', icon: <ShieldCheck size={18} />, trend: 'Secure' },
        { label: 'User Rating', value: '4.9', icon: <Star size={18} />, trend: 'Expert' }
    ];

    const preferences = [
        { icon: <Bell size={16} />, label: 'Notifications' },
        { icon: <Heart size={16} />, label: 'Wishlist Hub' },
        { icon: <MessageCircle size={16} />, label: 'Chat Access' },
        { icon: <Settings size={16} />, label: 'Settings' }
    ];

    if (isLoading) {
        return (
            <div className="profile-page">
                <div className="profile-layout-grid">
                    <aside className="profile-sidebar-premium">
                        <div className="profile-info-card skeleton-box">
                            <div className="profile-banner-skeleton shimmer"></div>
                            <div className="profile-identity-skeleton">
                                <div className="avatar-skeleton shimmer"></div>
                                <div className="text-skeleton-l shimmer"></div>
                            </div>
                            <div className="profile-actions-skeleton">
                                <div className="btn-skeleton shimmer"></div>
                                <div className="btn-skeleton shimmer"></div>
                            </div>
                        </div>
                    </aside>
                    <main className="profile-main-discovery">
                        <section className="discovery-stats-row">
                            {[1, 2, 3].map(i => <div key={i} className="stat-skeleton shimmer"></div>)}
                        </section>
                        <section className="discovery-section">
                            <div className="discovery-section-header-skeleton shimmer"></div>
                            <div className="discovery-item-grid">
                                {[1, 2, 3, 4].map(i => <div key={i} className="product-skeleton shimmer"></div>)}
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-layout-grid">
                {/* Left Performance Sidebar */}
                <aside className="profile-sidebar-premium">
                    <div className="profile-sticky-wrap">
                        <div className="profile-info-card">
                            <div className="profile-banner-compact">
                                {profile?.banner_url && <img src={profile.banner_url} alt="banner" className="profile-banner-img" />}
                                <div className="profile-avatar-overlap">
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="avatar" />
                                    ) : (
                                        <div className="avatar-placeholder-overlap">
                                            {(profile?.full_name || 'U').charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="profile-identity-stack">
                                <div className="profile-name-row">
                                    <h1>{profile?.full_name || 'Premium Member'}</h1>
                                    {profile?.is_verified && <span className="profile-role-tag">Verified</span>}
                                </div>
                                <p className="profile-bio-minimal">{profile?.bio || "Professional merchant and discovery specialist across the Bluestore marketplace."}</p>
                            </div>

                            <div className="profile-meta-vgrid">
                                <div className="meta-vbox">
                                    <span className="meta-vlabel">Location</span>
                                    <div className="meta-vcontent">
                                        <MapPin size={14} color="#94a3b8" />
                                        <span>{profile?.location || 'Set Location'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="profile-action-stack">
                                <button className="profile-pbtn primary" onClick={() => navigate('/publish')}>
                                    Create New Ad
                                </button>
                                <button className="profile-pbtn logout" onClick={signOut}>
                                    <LogOut size={16} /> 
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>

                        {/* Account Preferences - Relocated to Sidebar */}
                        <div className="profile-pref-card">
                            <span className="pref-vlabel">Account Hub</span>
                            <div className="pref-vlist">
                                {preferences.map((pref, i) => (
                                    <div key={i} className="pref-vitem">
                                        <div className="pref-vicon">{pref.icon}</div>
                                        <span>{pref.label}</span>
                                        <ArrowRight size={14} className="pref-narrow" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Discovery Area */}
                 <main className="profile-main-discovery">
                    <section className="discovery-stats-row">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="discovery-stat-tile-new">
                                <div className="stat-tile-header">
                                    <div className={`stat-tile-icon ${stat.trend.toLowerCase()}`}>
                                        {stat.icon}
                                    </div>
                                    <span className="stat-tile-trend">{stat.trend}</span>
                                </div>
                                <span className="stat-tile-value">{stat.value}</span>
                                <span className="stat-tile-label">{stat.label}</span>
                            </div>
                        ))}
                    </section>

                    <section className="discovery-section">
                        <div className="discovery-section-header">
                            <h2>My Active Ads</h2>
                            <Link to="/saved" className="discovery-section-link">Manage All <ArrowRight size={14} /></Link>
                        </div>
                        <div className="discovery-item-grid">
                            {listings.length === 0 ? (
                                <div className="empty-discovery-msg">No active items for discovery. Start by publishing a listing.</div>
                            ) : (
                                listings.slice(0, 4).map(item => (
                                    <ProductCard key={item.id} item={item} />
                                ))
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default Profile;
