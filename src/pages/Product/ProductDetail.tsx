import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
    Heart, 
    MessageCircle, 
    Phone, 
    ChevronLeft,
    ChevronRight,
    Flag, 
    User,
    Edit2,
    Trash2
} from 'lucide-react';
import ProductCard from '../../components/ProductCard/ProductCard';
import ReportModal from '../../components/ReportModal/ReportModal';
import './ProductDetail.css';

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [listing, setListing] = useState<any>(null);
    const [seller, setSeller] = useState<any>(null);
    const [relatedListings, setRelatedListings] = useState<any[]>([]);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeImage, setActiveImage] = useState(0);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    useEffect(() => {
        if (id) {
            fetchListing();
            setActiveImage(0);
        }
    }, [id]);

    const fetchListing = async () => {
        setIsLoading(true);
        try {
            const { data: listingData, error } = await supabase
                .from('listings')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setListing(listingData);

            // Fetch related
            const { data: related } = await supabase
                .from('listings')
                .select('*')
                .eq('category', listingData.category)
                .neq('id', id)
                .limit(4);
            setRelatedListings(related || []);

            if (listingData.user_id) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', listingData.user_id)
                    .single();
                setSeller(profileData);
            }

            if (user) {
                const { data: fav } = await supabase
                    .from('saved_listings')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('listing_id', id)
                    .maybeSingle();
                setIsFavorite(!!fav);
            }
        } catch (err) {
            console.error('Error fetching product:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return navigate('/login');
        const newFav = !isFavorite;
        setIsFavorite(newFav);
        if (newFav) {
            await supabase.from('saved_listings').insert([{ user_id: user.id, listing_id: id }]);
        } else {
            await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', id);
        }
    };

    const handleChat = () => {
        if (!user) return navigate('/login');
        navigate(`/chat/new?listingId=${id}&recipientId=${seller.id}`);
    };

    const handleDelete = async () => {
        if (!window.confirm('Definitive inventory removal? This cannot be undone.')) return;
        try {
            const { error } = await supabase.from('listings').delete().eq('id', id);
            if (error) throw error;
            navigate('/profile');
        } catch (err) {
            console.error('Delete error:', err);
            alert('Property decommissioning failed.');
        }
    };

    if (isLoading) {
        return (
            <div className="product-detail-page">
                <div className="product-container-premium">
                    <div className="pd-main-grid">
                        <div className="pd-gallery-section">
                            <div className="skeleton-pd-hero skeleton"></div>
                            <div className="pd-thumbs-horizontal">
                                {Array(4).fill(0).map((_, i) => (
                                    <div key={i} className="skeleton-pd-thumb skeleton"></div>
                                ))}
                            </div>
                        </div>
                        <div className="pd-info-panel">
                            <div className="pd-header-group">
                                <div className="skeleton-pd-title skeleton"></div>
                                <div className="skeleton-pd-price skeleton"></div>
                            </div>
                            <div className="skeleton-pd-box skeleton"></div>
                            <div className="pd-actions-group">
                                <div className="pd-main-actions">
                                    <div className="skeleton-pd-btn skeleton"></div>
                                </div>
                                <div className="pd-util-btns">
                                    <div className="skeleton-pd-btn skeleton"></div>
                                    <div className="skeleton-pd-btn skeleton"></div>
                                </div>
                            </div>
                            <div className="skeleton-pd-seller skeleton"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    if (!listing) return <div className="product-error">Product footprint not found</div>;

    const images = listing.images || [];

    return (
        <div className="product-detail-page">
            <div className="product-container-premium">
                <div className="pd-main-grid">
                    {/* Gallery - Stacked layout */}
                    <div className="pd-gallery-section">
                        <div className="pd-main-viewport">
                            {images.length > 1 && (
                                <>
                                    <button 
                                        className="pd-nav-arrow left"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveImage(prev => prev === 0 ? images.length - 1 : prev - 1);
                                        }}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button 
                                        className="pd-nav-arrow right"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveImage(prev => prev === images.length - 1 ? 0 : prev + 1);
                                        }}
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </>
                            )}
                            <img src={images[activeImage] || 'https://via.placeholder.com/600'} alt="product" />
                        </div>
                        <div className="pd-thumbs-horizontal">
                            {images.map((img: string, idx: number) => (
                                <div 
                                    key={idx} 
                                    className={`pd-h-thumb ${activeImage === idx ? 'active' : ''}`}
                                    onClick={() => setActiveImage(idx)}
                                >
                                    <img src={img} alt="thumb" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Info Area */}
                    <div className="pd-info-panel">
                        <div className="pd-header-group">
                            <span className="pd-meta-cat">{listing.category} / {listing.brand}</span>
                            <h1 className="pd-main-title">{listing.title}</h1>
                            <div className="pd-price-wrap">
                                <span className="pd-price-text">GH₵{listing.price.toLocaleString()}</span>
                                <div className="pd-negotiable-badge">Negotiable</div>
                            </div>
                        </div>

                        <div className="pd-details-box">
                            <div className="pd-detail-item">
                                <span className="pd-detail-label">Condition</span>
                                <span className="pd-detail-val">{listing.condition}</span>
                            </div>
                            <div className="pd-detail-item">
                                <span className="pd-detail-label">Location</span>
                                <span className="pd-detail-val">{listing.location}</span>
                            </div>
                            <div className="pd-detail-item">
                                <span className="pd-detail-label">Category</span>
                                <span className="pd-detail-val">{listing.category}</span>
                            </div>
                            <div className="pd-detail-item">
                                <span className="pd-detail-label">Posted</span>
                                <span className="pd-detail-val">
                                    {(() => {
                                        const now = new Date();
                                        const created = new Date(listing.created_at);
                                        const diff = Math.floor((now.getTime() - created.getTime()) / 1000);
                                        
                                        if (diff < 60) return 'Just now';
                                        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                                        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
                                        return created.toLocaleDateString();
                                    })()}
                                </span>
                            </div>
                        </div>

                        <div className="pd-actions-group">
                            {user?.id === listing.user_id ? (
                                <div className="pd-owner-actions">
                                    <button className="pd-edit-btn" onClick={() => navigate(`/edit/${id}`)}>
                                        <Edit2 size={20} />
                                        <span>Edit Listing</span>
                                    </button>
                                    <button className="pd-delete-btn" onClick={handleDelete}>
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="pd-main-actions">
                                        <button className="pd-msg-btn" onClick={handleChat}>
                                            <MessageCircle size={22} />
                                            <span>Start Business Chat</span>
                                        </button>
                                        <button className="pd-call-btn">
                                            <Phone size={22} color="#2563eb" />
                                        </button>
                                    </div>
                                    <div className="pd-util-btns">
                                        <button className={`pd-util-btn fav ${isFavorite ? 'active' : ''}`} onClick={toggleFavorite}>
                                            <Heart size={20} fill={isFavorite ? '#ef4444' : 'none'} color={isFavorite ? '#ef4444' : '#111'} />
                                            <span>{isFavorite ? 'Saved' : 'Save Item'}</span>
                                        </button>
                                        <button className="pd-util-btn" onClick={() => setIsReportModalOpen(true)}>
                                            <Flag size={20} color="#ef4444" />
                                            <span>Report Product</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="pd-seller-summary">
                            <div className="pd-seller-logo">
                                {seller?.avatar_url ? (
                                    <img src={seller.avatar_url} alt="seller" />
                                ) : (
                                    <User size={24} color="#fff" />
                                )}
                            </div>
                            <div className="pd-seller-info">
                                <h4>{seller?.full_name || 'Verified Partner'}</h4>
                                <div className="pd-seller-status">Verified Seller / Top Rated</div>
                            </div>
                            <button className="pd-seller-view-link" onClick={() => navigate(`/seller/${seller.id}`)}>
                                View Profile
                            </button>
                        </div>
                    </div>
                </div>

                {/* Full Width Description Section */}
                <div className="pd-full-description">
                    <h3>Specifications</h3>
                    <div className="pd-description-content">
                        {listing.description || 'No detailed technical specifications provided for this product footprints.'}
                    </div>
                </div>

                {relatedListings.length > 0 && (
                    <div className="pd-related-section">
                        <h2>Similar to this search</h2>
                        <div className="pd-related-grid">
                            {relatedListings.map(item => (
                                <ProductCard key={item.id} item={item} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Safety Guardrail Modal */}
            {listing && seller && (
                <ReportModal 
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    targetType="listing"
                    targetId={listing.id}
                    targetName={listing.title}
                />
            )}
        </div>
    );
};

export default ProductDetail;
