import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { subscriptions } from '../../lib/subscriptions';
import { ArrowLeft, Check, Lock, ShieldCheck, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PaymentDrawer } from '../../components/PaymentDrawer';
import './Pricing.css';

type TabType = 'plans' | 'boosts';

const Pricing: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('plans');
    const [packages, setPackages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userStatus, setUserStatus] = useState<any>(null);
    const [myListings, setMyListings] = useState<any[]>([]);

    // Payment States
    const [paymentVisible, setPaymentVisible] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);
    const [targetListingId, setTargetListingId] = useState<string | null>(null);
    const [isListingSelectorVisible, setIsListingSelectorVisible] = useState(false);

    useEffect(() => {
        if (user) {
            fetchPricingData();
            fetchMyListings();
        }
    }, [user]);

    const fetchPricingData = async () => {
        setIsLoading(true);
        try {
            const { data: pkgData } = await supabase
                .from('subscription_packages')
                .select('*')
                .eq('is_active', true)
                .order('price_ghs', { ascending: true });
            
            if (pkgData) setPackages(pkgData);

            if (user) {
                const status = await subscriptions.getUserStatus(user.id);
                setUserStatus(status);
            }
        } catch (err) {
            console.error('Fetch pricing error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMyListings = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('listings')
            .select('id, title, images, status, is_boosted')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
        
        if (data) setMyListings(data);
    };

    const handlePurchaseInitiation = (pkg: any) => {
        if (pkg.price_ghs === 0) return;

        setSelectedPackage(pkg);
        if (pkg.package_type === 'boost') {
            if (myListings.length === 0) {
                alert('Publish an approved listing first before purchasing a boost.');
                return;
            }
            setIsListingSelectorVisible(true);
        } else {
            setPaymentVisible(true);
        }
    };

    const handleListingSelect = (listingId: string) => {
        setTargetListingId(listingId);
        setIsListingSelectorVisible(false);
        setPaymentVisible(true);
    };

    const handlePaymentSuccess = async (ref: string) => {
        console.log('Payment success ref:', ref);
        await fetchPricingData();
        await fetchMyListings();
        alert('Payment Successful! Your plan/boost is now active.');
    };

    const filteredPackages = packages.filter(p => 
        activeTab === 'plans' ? p.package_type === 'subscription' : p.package_type === 'boost'
    );

    if (isLoading) {
        return (
            <div className="pricing-page-skeleton">
                <div className="pr-header-skeleton shimmer"></div>
                <div className="pr-container">
                    <div className="pr-hero-skeleton shimmer"></div>
                    <div className="pr-tabs-skeleton shimmer"></div>
                    <div className="pr-packages-row">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="pr-card-skeleton">
                                <div className="pr-card-head-sk shimmer"></div>
                                <div className="pr-card-line-sk shimmer"></div>
                                <div className="pr-card-line-sk shimmer" style={{ width: '80%' }}></div>
                                <div className="pr-card-features-sk">
                                    {[1, 2, 3].map(j => <div key={j} className="pr-feat-sk shimmer"></div>)}
                                </div>
                                <div className="pr-card-btn-sk shimmer"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pricing-page">
            <header className="pr-header">
                <button className="pr-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <div className="pr-header-title">
                    <h1>Bluestore Pro</h1>
                    <div className="pr-pro-badge">PRO</div>
                </div>
                <div style={{ width: 44 }}></div>
            </header>

            <div className="pr-container">
                {userStatus && (
                    <section className="pr-hero-card">
                        <div className="pr-hero-info">
                            <div>
                                <span className="pr-hero-label">Active Membership</span>
                                <h2 className="pr-hero-title">{userStatus.package_name}</h2>
                            </div>
                            <div className="pr-hero-icon-box">
                                <ShieldCheck size={32} />
                            </div>
                        </div>
                        <div className="pr-usage-section">
                            <div className="pr-usage-labels">
                                <span>Inventory Usage</span>
                                <b>{userStatus.current_count} / {userStatus.limit || 'Unlimited'}</b>
                            </div>
                            <div className="pr-usage-bar-bg">
                                <div 
                                    className="pr-usage-bar-fill" 
                                    style={{ width: userStatus.limit ? `${(userStatus.current_count / userStatus.limit) * 100}%` : '100%' }}
                                ></div>
                            </div>
                        </div>
                    </section>
                )}

                <div className="pr-tab-controls">
                    <button 
                        className={activeTab === 'plans' ? 'active' : ''} 
                        onClick={() => setActiveTab('plans')}
                    >
                        Inventory Plans
                    </button>
                    <button 
                        className={activeTab === 'boosts' ? 'active' : ''} 
                        onClick={() => setActiveTab('boosts')}
                    >
                        Boost Ads
                    </button>
                </div>

                <div className="pr-packages-grid">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={activeTab}
                            className="pr-packages-row"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {filteredPackages.map((pkg) => {
                                const isCurrent = userStatus?.package_name === pkg.name;
                                return (
                                    <div key={pkg.id} className={`pr-package-card ${pkg.price_ghs > 100 ? 'featured' : ''}`}>
                                        {pkg.name.includes('Standard') && !isCurrent && <div className="pr-ribbon blue">Recommended</div>}
                                        {pkg.name.includes('Premium') && !isCurrent && <div className="pr-ribbon gold">Elite Choice</div>}
                                        {isCurrent && <div className="pr-ribbon active-plan">Current Plan</div>}
                                        
                                        <div className="pr-card-header">
                                            <div className="pr-pkg-main">
                                                <h3>{pkg.name}</h3>
                                                <p>{activeTab === 'plans' ? 'Monthly Access' : 'One-time Promo'}</p>
                                            </div>
                                            <div className="pr-pkg-price">
                                                <span className="pr-currency">GH₵</span>
                                                <span className="pr-amount">{pkg.price_ghs}</span>
                                            </div>
                                        </div>

                                        <p className="pr-pkg-desc">{pkg.description}</p>

                                        <div className="pr-pkg-features">
                                            {pkg.features?.map((f: string, i: number) => (
                                                <div key={i} className="pr-feature-line">
                                                    <div className="pr-check-circle"><Check size={14} /></div>
                                                    <span>{f}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <button 
                                            className={`pr-action-btn ${pkg.price_ghs === 0 || isCurrent ? 'disabled' : ''}`}
                                            onClick={() => handlePurchaseInitiation(pkg)}
                                            disabled={pkg.price_ghs === 0 || isCurrent}
                                        >
                                            {isCurrent ? 'Plan Active' : pkg.price_ghs === 0 ? 'Free Tier' : `Get ${pkg.name.split(' ')[0]}`}
                                        </button>
                                    </div>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="pr-guarantee-banner">
                    <div className="pr-g-icon"><Lock size={20} /></div>
                    <div className="pr-g-text">
                        <h4>Secure Marketplace Scaling</h4>
                        <p>All payments are processed securely via Paystack. Your plan updates instantly.</p>
                    </div>
                </div>
            </div>

            {/* Listing Selector for Boosts */}
            <AnimatePresence>
                {isListingSelectorVisible && (
                    <div className="boost-selector-root">
                        <motion.div className="bs-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsListingSelectorVisible(false)} />
                        <motion.div className="bs-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}>
                            <header className="bs-header">
                                <div>
                                    <h3>Select Ad to Boost</h3>
                                    <p>Choose an approved listing to promote</p>
                                </div>
                                <button className="bs-close" onClick={() => setIsListingSelectorVisible(false)}><X size={20} /></button>
                            </header>
                            <div className="bs-list">
                                {myListings.length > 0 ? (
                                    myListings.map(l => (
                                        <button key={l.id} className="bs-item" onClick={() => handleListingSelect(l.id)}>
                                            <img src={l.images?.[0]} alt="" />
                                            <div className="bs-item-info">
                                                <h4>{l.title}</h4>
                                                <span>{l.status.toUpperCase()}</span>
                                            </div>
                                            <ChevronRight size={18} />
                                        </button>
                                    ))
                                ) : (
                                    <div className="bs-empty">No active listings found.</div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Paystack Payment Drawer */}
            {selectedPackage && (
                <PaymentDrawer 
                    visible={paymentVisible}
                    onClose={() => setPaymentVisible(false)}
                    onSuccess={handlePaymentSuccess}
                    amount={selectedPackage.price_ghs}
                    description={selectedPackage.name}
                    metadata={{
                        package_id: selectedPackage.id,
                        user_id: user?.id,
                        listing_id: targetListingId,
                        package_type: selectedPackage.package_type
                    }}
                />
            )}
        </div>
    );
};

export default Pricing;
