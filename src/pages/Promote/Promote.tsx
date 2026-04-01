import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { paystack } from '../../lib/paystack';
import { Check, ArrowLeft, Zap } from 'lucide-react';
import { PaymentDrawer } from '../../components/PaymentDrawer';
import { motion } from 'framer-motion';
import './Promote.css';

const Promote: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [listing, setListing] = useState<any>(null);
    const [packages, setPackages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Payment States
    const [paymentVisible, setPaymentVisible] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const { data: listData, error: listError } = await supabase
                .from('listings')
                .select('*')
                .eq('id', id)
                .single();
            
            if (listError) throw listError;
            setListing(listData);

            const { data: pkgData } = await supabase
                .from('subscription_packages')
                .select('*')
                .eq('package_type', 'boost')
                .eq('is_active', true)
                .order('price_ghs', { ascending: true });
            
            if (pkgData) setPackages(pkgData);
        } catch (err) {
            console.error('Error fetching promote data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBoostInitiation = (pkg: any) => {
        setSelectedPackage(pkg);
        setPaymentVisible(true);
    };

    const handlePaymentSuccess = async (ref: string) => {
        if (!user) return;
        try {
            const success = await paystack.handleSuccessfulPayment(ref, user.id);
            if (success) {
                alert('Boost Activated! Your listing is now trending.');
                navigate('/');
            }
        } catch (err) {
            console.error('Verify payment error:', err);
            alert('Payment verification failed. Contact support.');
        }
    };

    if (isLoading) return <div className="loading-dots"><div className="dot"/><div className="dot"/><div className="dot"/></div>;

    return (
        <div className="promote-page">
            <header className="pmt-header">
                <button className="pmt-back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={20} />
                </button>
            </header>

            <div className="pmt-container">
                <motion.div 
                    className="pmt-success-badge"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <div className="pmt-check-circle">
                        <Check size={40} />
                    </div>
                    <h2>Listing Submitted!</h2>
                    <p>Reach more buyers by boosting your ad instantly.</p>
                </motion.div>

                {listing && (
                    <div className="pmt-listing-preview">
                        <img src={listing.images?.[0]} alt="" className="pmt-preview-img" />
                        <div className="pmt-preview-info">
                            <h4>{listing.title}</h4>
                            <span>GH₵{listing.price}</span>
                        </div>
                    </div>
                )}

                <h3 className="pmt-section-title">Select a Boost Package</h3>

                <div className="pmt-packages-list">
                    {packages.map((pkg, idx) => (
                        <motion.div 
                            key={pkg.id}
                            className="pmt-pkg-card"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => handleBoostInitiation(pkg)}
                        >
                            <div className="pmt-pkg-header">
                                <div className="pmt-pkg-badge">
                                    <Zap size={14} />
                                    <span>TRENDING AD</span>
                                </div>
                                <span className="pmt-pkg-price">GH₵{pkg.price_ghs}</span>
                            </div>
                            <h3>{pkg.name}</h3>
                            <p>{pkg.description}</p>
                            <div className="pmt-pkg-features">
                                {pkg.features?.map((f: string, i: number) => (
                                    <div key={i} className="pmt-feat">
                                        <Check size={14} />
                                        <span>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <button className="pmt-pkg-btn">
                                Boost Ad • GH₵{pkg.price_ghs}
                            </button>
                        </motion.div>
                    ))}
                </div>

                <button className="pmt-skip-btn" onClick={() => navigate('/')}>
                    No thanks, continue with free listing
                </button>
            </div>

            {selectedPackage && (
                <PaymentDrawer 
                    visible={paymentVisible}
                    onClose={() => setPaymentVisible(false)}
                    onSuccess={handlePaymentSuccess}
                    amount={selectedPackage.price_ghs}
                    description={`Boosting "${listing?.title}"`}
                    metadata={{
                        package_id: selectedPackage.id,
                        user_id: user?.id,
                        listing_id: id,
                        package_type: 'boost'
                    }}
                />
            )}
        </div>
    );
};

export default Promote;
