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
    Heart,
    Clock,
    Zap,
    ChevronRight,
    BarChart3,
    HelpCircle,
    User as UserIcon
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
    const [stats, setStats] = useState({
        listingsCount: 0,
        joinedDate: 'Feb 2026',
        rating: '4.9',
        responseRate: '95%'
    });

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

            // Fetch listings count
            const { count } = await supabase
                .from('listings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user?.id);

            setStats({
                listingsCount: count || 0,
                joinedDate: profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Feb 2026',
                rating: '4.9', // Default or fetch from reviews
                responseRate: '98%' // Default or calculated
            });

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

    const statItems = [
        { label: 'Listings', value: stats.listingsCount, icon: <ShoppingBag size={18} />, trend: 'Active' },
        { label: 'Joined', value: stats.joinedDate, icon: <Clock size={18} />, trend: 'Member' },
        { label: 'Rating', value: stats.rating, icon: <Star size={18} />, trend: 'Expert' },
        { label: 'Response', value: stats.responseRate, icon: <Zap size={18} />, trend: 'Fast' }
    ];

    const preferences = [
        { icon: <Bell size={16} />, label: 'Notifications' },
        { icon: <Heart size={16} />, label: 'Wishlist Hub' },
        { icon: <MessageCircle size={16} />, label: 'Chat Access' },
        { icon: <Settings size={16} />, label: 'Settings' }
    ];

    // Mobile specific menu items from mobile app
    const mobileMenuItems = [
        { icon: <Star size={20} />, label: 'BlueStore Pro', sub: 'Subscription & Boosts', path: '/pricing' },
        { icon: <ShoppingBag size={20} />, label: 'My Listings', sub: 'Manage your active items', path: '/my-listings' },
        { icon: <BarChart3 size={20} />, label: 'Store Analytics', sub: 'Performance, Views, and Leads', path: '/analytics' },
        { icon: <UserIcon size={20} />, label: 'Personal Information', sub: 'Name, Email, Phone', path: '/personal-info' },
        { icon: <Bell size={20} />, label: 'Notifications', sub: 'App alerts and messages', path: '/notifications' },
        { icon: <ShieldCheck size={20} />, label: 'Security', sub: 'Password and 2FA', path: '/security' },
        { icon: <HelpCircle size={20} />, label: 'Help Center', sub: 'FAQ and Support', path: '/help' },
    ];

    if (isLoading) {
        return (
            <div className="profile-page">
                {/* Desktop Skeleton */}
                <div className="profile-layout-grid desktop-only">
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
                            {[1, 2, 3, 4].map(i => <div key={i} className="stat-skeleton shimmer"></div>)}
                        </section>
                        <section className="discovery-section">
                            <div className="discovery-section-header-skeleton shimmer"></div>
                            <div className="discovery-item-grid">
                                {[1, 2, 3, 4].map(i => <div key={i} className="product-skeleton shimmer"></div>)}
                            </div>
                        </section>
                    </main>
                </div>

                {/* Mobile Skeleton */}
                <div className="mobile-profile-modern mobile-only">
                    <div className="m-banner-area shimmer"></div>
                    <div className="m-identity-card">
                        <div className="m-avatar-wrap" style={{ marginTop: '-50px' }}>
                            <div className="m-avatar-box skeleton shimmer"></div>
                        </div>
                        <div className="m-user-info">
                            <div className="skeleton shimmer" style={{ height: '30px', width: '60%', borderRadius: '8px', marginBottom: '12px' }}></div>
                            <div className="skeleton shimmer" style={{ height: '28px', width: '40%', borderRadius: '100px', marginBottom: '16px' }}></div>
                            <div className="skeleton shimmer" style={{ height: '60px', width: '100%', borderRadius: '12px' }}></div>
                        </div>
                        <div className="m-stats-grid">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="m-stat-box">
                                    <div className="skeleton shimmer" style={{ height: '20px', width: '30px', borderRadius: '4px', marginBottom: '8px' }}></div>
                                    <div className="skeleton shimmer" style={{ height: '12px', width: '40px', borderRadius: '4px' }}></div>
                                </div>
                            ))}
                        </div>
                        <div className="m-menu-list">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="m-menu-item skeleton shimmer" style={{ height: '76px', borderRadius: '20px' }}></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            {/* Desktop View */}
            <div className="profile-layout-grid desktop-only">
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
                        {statItems.map((stat, idx) => (
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

            {/* Mobile View - Ported from Mobile App Design */}
            <div className="mobile-profile-modern mobile-only">
                <div className="m-profile-hero">
                    <div className="m-banner-area">
                        {profile?.banner_url ? (
                            <img src={profile.banner_url} alt="banner" className="m-banner-img" />
                        ) : (
                            <div className="m-banner-placeholder">
                                <span className="m-logo-faded">bluestore</span>
                            </div>
                        )}
                        <div className="m-banner-actions">
                            <button className="m-action-circle"><ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} onClick={() => navigate(-1)} /></button>
                        </div>
                    </div>

                    <div className="m-identity-card">
                        <div className="m-avatar-wrap">
                            <div className="m-avatar-box">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="avatar" />
                                ) : (
                                    <div className="m-avatar-placeholder">
                                        {(profile?.full_name || 'U').charAt(0)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="m-user-info">
                            <h1 className="m-user-name">{profile?.full_name || 'Anonymous user'}</h1>
                            <div className="m-location-pill" onClick={() => navigate('/settings/location')}>
                                <MapPin size={12} />
                                <span>{profile?.location || 'Set your location...'}</span>
                                <ChevronRight size={12} />
                            </div>
                            <p className="m-user-bio">
                                {profile?.bio || "Share your store's story. Click edit to add a bio..."}
                            </p>
                        </div>

                        <div className="m-stats-grid">
                            <div className="m-stat-box">
                                <span className="m-stat-val">{stats.listingsCount}</span>
                                <span className="m-stat-label">Listings</span>
                            </div>
                            <div className="m-stat-box">
                                <span className="m-stat-val">{stats.joinedDate}</span>
                                <span className="m-stat-label">Joined</span>
                            </div>
                            <div className="m-stat-box">
                                <span className="m-stat-val">{stats.rating}</span>
                                <span className="m-stat-label">Rating</span>
                            </div>
                            <div className="m-stat-box">
                                <span className="m-stat-val">{stats.responseRate}</span>
                                <span className="m-stat-label">Response</span>
                            </div>
                        </div>

                        {profile?.verification_status !== 'verified' && (
                            <div className="m-verify-banner" onClick={() => navigate('/verification')}>
                                <div className="m-verify-icon">
                                    <ShieldCheck size={20} color="#0057FF" />
                                </div>
                                <div className="m-verify-text">
                                    <h3>Verify your account</h3>
                                    <p>Build trust and sell your items faster.</p>
                                </div>
                                <ChevronRight size={18} color="#ABABAB" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="m-settings-section">
                    <h2 className="m-section-title">Account Settings</h2>
                    <div className="m-menu-list">
                        {mobileMenuItems.map((item, i) => (
                            <div key={i} className="m-menu-item" onClick={() => navigate(item.path)}>
                                <div className="m-menu-icon" style={{ color: '#0057FF' }}>{item.icon}</div>
                                <div className="m-menu-content">
                                    <h4>{item.label}</h4>
                                    <p>{item.sub}</p>
                                </div>
                                <ChevronRight size={18} color="#ABABAB" />
                            </div>
                        ))}
                    </div>

                    <button className="m-logout-btn" onClick={signOut}>
                        <LogOut size={20} />
                        <span>Log Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
