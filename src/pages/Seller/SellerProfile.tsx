import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
    MapPin, 
    MessageCircle, 
    Calendar,
    ShoppingBag,
    ShieldCheck,
    Star,
    ShieldAlert
} from 'lucide-react';
import ProductCard from '../../components/ProductCard/ProductCard';
import ReportModal from '../../components/ReportModal/ReportModal';
import './SellerProfile.css';

const SellerProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [seller, setSeller] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    useEffect(() => {
        if (id) fetchSellerData();
    }, [id]);

    const fetchSellerData = async () => {
        setIsLoading(true);
        try {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
            setSeller(profile);

            const { data: listings } = await supabase
                .from('listings')
                .select('*')
                .eq('user_id', id)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });
            setProducts(listings || []);
        } catch (err) {
            console.error('Error fetching seller:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="seller-profile-page">
                <div className="seller-layout-grid">
                    <aside className="seller-sidebar-premium">
                        <div className="seller-info-card skeleton-box">
                            <div className="seller-banner-skeleton shimmer"></div>
                            <div className="seller-identity-skeleton">
                                <div className="avatar-skeleton shimmer"></div>
                                <div className="text-skeleton-l shimmer"></div>
                                <div className="text-skeleton-m shimmer"></div>
                            </div>
                            <div className="seller-actions-skeleton">
                                <div className="btn-skeleton shimmer"></div>
                                <div className="btn-skeleton shimmer"></div>
                            </div>
                        </div>
                    </aside>
                    <main className="profile-main-discovery">
                        <section className="discovery-stats-row">
                            {[1, 2, 3].map(i => <div key={i} className="stat-skeleton shimmer"></div>)}
                        </section>
                        <section className="inventory-section">
                            <div className="discovery-section-header-skeleton shimmer"></div>
                            <div className="inventory-grid">
                                {[1, 2, 3, 4].map(i => <div key={i} className="product-skeleton shimmer"></div>)}
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        );
    }
    if (!seller) return <div className="seller-error">Store not found</div>;

    const stats = [
        { label: 'Active Deals', value: products.length, icon: <ShoppingBag size={18} />, trend: 'Primary' },
        { label: 'Platform Trust', value: '98%', icon: <ShieldCheck size={18} />, trend: 'Secure' },
        { label: 'User Rating', value: '4.9', icon: <Star size={18} />, trend: 'Expert' }
    ];

    return (
        <div className="seller-profile-page">
            <div className="seller-layout-grid">
                {/* Left Merchant Sidebar */}
                <aside className="seller-sidebar-premium">
                    <div className="seller-sticky-wrap">
                        <div className="seller-info-card">
                            <div className="seller-banner-compact">
                                {seller.banner_url && <img src={seller.banner_url} alt="banner" className="seller-banner-img" />}
                                <div className="seller-avatar-overlap">
                                    {seller.avatar_url ? (
                                        <img src={seller.avatar_url} alt="avatar" />
                                    ) : (
                                        <div className="avatar-placeholder-overlap">
                                            {(seller.full_name || 'U').charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="seller-identity-stack">
                                <div className="seller-name-row">
                                    <h1>{seller.full_name || 'Premium Merchant'}</h1>
                                    {seller.is_verified && <span className="seller-verify-tag">Verified</span>}
                                </div>
                                <p className="seller-bio-minimal">{seller.bio || "This merchant has provided a world-class discovery experience for high-quality items and professional tools."}</p>
                            </div>

                            <div className="seller-meta-vgrid">
                                <div className="meta-vbox">
                                    <span className="meta-vlabel">Market Base</span>
                                    <div className="meta-vcontent">
                                        <MapPin size={14} color="#94a3b8" />
                                        <span>{seller.location || 'Nationwide Discovery'}</span>
                                    </div>
                                </div>
                                <div className="meta-vbox">
                                    <span className="meta-vlabel">Merchant Era</span>
                                    <div className="meta-vcontent">
                                        <Calendar size={14} color="#94a3b8" />
                                        <span>Active Since {new Date(seller.created_at).getFullYear()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Removed Compact Merchant Reputation */}

                            <div className="seller-action-stack">
                                <button className="seller-pbtn primary">
                                    <MessageCircle size={18} /> Chat with Store
                                </button>
                                <button className="seller-pbtn secondary" onClick={() => setIsReportModalOpen(true)}>
                                    <ShieldAlert size={18} color="#ef4444" /> Report Merchant
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right Inventory Discovery Area */}
                 <main className="seller-main-discovery">
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

                    <section className="inventory-section">
                        <div className="inventory-header-minimal">
                            <h2>Merchant Inventory</h2>
                            <p>Showing {products.length} industrial-grade listings</p>
                        </div>
                        <div className="inventory-grid">
                            {products.map(item => (
                                <ProductCard key={item.id} item={item} />
                            ))}
                        </div>
                    </section>
                </main>
            </div>

            {/* Safety Guardrail Modal */}
            {seller && (
                <ReportModal 
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    targetType="profile"
                    targetId={seller.id}
                    targetName={seller.full_name}
                />
            )}
        </div>
    );
};

export default SellerProfile;
