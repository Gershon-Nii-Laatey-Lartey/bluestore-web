import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Star, MessageSquare, CheckCircle, User, Loader2, Send } from 'lucide-react';
import './ReviewSystem.css';

interface ReviewSystemProps {
    receiverId: string;
    listingId?: string;
    type: 'seller' | 'product';
    compact?: boolean;
}

const ReviewSystem: React.FC<ReviewSystemProps> = ({ receiverId, listingId, type, compact }) => {
    const { user } = useAuth();
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({ avg: 0, total: 0 });
    
    const [showForm, setShowForm] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchReviews();
        fetchStats();
    }, [receiverId]);

    const fetchReviews = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('reviews')
                .select(`
                    *,
                    reviewer:profiles(id, full_name, avatar_url),
                    listing:listings(id, title)
                `)
                .eq('receiver_id', receiverId)
                .order('created_at', { ascending: false });

            if (data) {
                console.log('Reviews for', receiverId, ':', data.length);
                setReviews(data);
            }
        } catch (err) {
            console.error('Reviews error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async () => {
        const { data } = await supabase.rpc('get_seller_rating', { seller_uuid: receiverId });
        if (data && data[0]) {
            setStats({ avg: data[0].avg_rating || 0, total: data[0].total_reviews || 0 });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('reviews').insert([{
                reviewer_id: user.id,
                receiver_id: receiverId,
                listing_id: listingId,
                rating,
                comment,
                is_verified: true // In a real app, verify against chat/transaction
            }]);

            if (error) throw error;
            setShowForm(false);
            setComment('');
            setRating(5);
            fetchReviews();
            fetchStats();
        } catch (err) {
            console.error('Submit review error:', err);
            alert('Failed to submit review. Have you already reviewed this item?');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (compact) {
        const lastReview = reviews[0];
        
        if (isLoading) {
            return (
                <div className="review-vcore-compact loading">
                    <div className="compact-stats-pill skeleton-shimmer"></div>
                    <div className="compact-comment-skeleton skeleton-shimmer"></div>
                </div>
            );
        }

        return (
            <div className="review-vcore-compact">
                <div className="compact-stats-pill">
                    <Star size={12} fill="#fbbf24" color="#fbbf24" />
                    <strong>{stats.avg}</strong>
                    <span>({stats.total} reviews)</span>
                </div>
                
                {lastReview ? (
                    <div className="compact-last-review">
                        <p className="compact-comment">"{lastReview.comment.substring(0, 80)}{lastReview.comment.length > 80 ? '...' : ''}"</p>
                        <div className="compact-reviewer">
                            <span>— {lastReview.reviewer?.full_name || 'Anonymous Discovery'}</span>
                        </div>
                    </div>
                ) : stats.total > 0 ? (
                    <div className="compact-loading-fallback">
                        <Loader2 className="spinner" size={14} />
                        <span>Fetching feedback details...</span>
                    </div>
                ) : (
                    <p className="compact-empty">No reviews yet.</p>
                )}

                <button className="compact-see-more-btn" onClick={() => {/* Maybe navigate or open modal */}}>
                    Explore All Feedback <ArrowRight size={12} />
                </button>
            </div>
        );
    }

    return (
        <div className="review-system-vcore">
            <header className="review-vcore-header">
                <div className="review-stats-summary">
                    <h2>{type === 'product' ? 'Discovery Feedback' : 'Merchant Reputation'}</h2>
                    <div className="stats-pill">
                        <Star size={14} fill="#fbbf24" color="#fbbf24" />
                        <span className="stats-avg">{stats.avg}</span>
                        <span className="stats-total">({stats.total} reviews)</span>
                    </div>
                </div>
                {user && user.id !== receiverId && !showForm && (
                    <button className="add-review-trigger-btn" onClick={() => setShowForm(true)}>
                        <PlusIcon size={14} />
                        <span>Leave Feedback</span>
                    </button>
                )}
            </header>

            {showForm && (
                <div className="review-form-container">
                    <form className="review-submission-form" onSubmit={handleSubmit}>
                        <div className="rating-selector-hub">
                            <span className="rating-label">How was your discovery experience?</span>
                            <div className="stars-input-grid">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button 
                                        key={s} 
                                        type="button" 
                                        className={`star-choice ${s <= rating ? 'active' : ''}`}
                                        onClick={() => setRating(s)}
                                    >
                                        <Star size={24} fill={s <= rating ? "#fbbf24" : "none"} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="comment-input-area">
                            <textarea 
                                placeholder="Describe the quality of item and merchant behavior..." 
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                                required
                            />
                        </div>

                        <div className="review-form-actions">
                            <button type="button" className="review-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
                            <button type="submit" className="review-submit-btn" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="spinner" size={16} /> : <><Send size={14} /> <span>Submit Feedback</span></>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="reviews-feed-stream">
                {isLoading ? (
                    <div className="reviews-loading-state">
                        <div className="loading-dots"><div className="dot" /><div className="dot" /><div className="dot" /></div>
                        <span>Ground-truthing reputation hubs...</span>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="reviews-empty-state">
                        <MessageSquare size={32} color="#e2e8f0" />
                        <p>No feedback received yet.</p>
                    </div>
                ) : (
                    reviews.map(review => (
                        <div key={review.id} className="review-item-card">
                            <div className="review-card-header">
                                <div className="reviewer-identity">
                                    {review.reviewer?.avatar_url ? (
                                        <img src={review.reviewer.avatar_url} alt="avatar" />
                                    ) : (
                                        <div className="reviewer-avatar-placeholder"><User size={14} /></div>
                                    )}
                                    <div className="reviewer-meta">
                                        <h4>{review.reviewer?.full_name || 'Anonymous User'}</h4>
                                        <span className="review-date">{new Date(review.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="review-rating-stars">
                                    {[1,2,3,4,5].map(s => (
                                        <Star key={s} size={12} fill={s <= review.rating ? "#fbbf24" : "none"} color={s <= review.rating ? "#fbbf24" : "#e2e8f0"} />
                                    ))}
                                </div>
                            </div>
                            <p className="review-comment-content">{review.comment}</p>
                            {review.is_verified && (
                                <div className="review-trust-footer">
                                    <div className="verified-badge-wrap">
                                        <CheckCircle size={10} color="#10b981" />
                                        <span>Verified Discovery</span>
                                    </div>
                                    {review.listing && (
                                        <div className="review-listing-ref">
                                            for <strong>{review.listing.title}</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const PlusIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.3s ease' }}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const ArrowRight = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

export default ReviewSystem;
