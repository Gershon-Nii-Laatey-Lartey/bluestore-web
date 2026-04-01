import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../../components/ProductCard/ProductCard';
import './Saved.css';

const Saved: React.FC = () => {
    const { user } = useAuth();
    const [savedItems, setSavedItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) fetchSavedItems();
    }, [user]);

    const fetchSavedItems = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('saved_listings')
                .select(`
                    id,
                    listing_id,
                    listing:listings (*)
                `)
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });
            setSavedItems(data || []);
        } catch (err) {
            console.error('Error fetching saved items:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const unsaveItem = async (listingId: string) => {
        const { error } = await supabase
            .from('saved_listings')
            .delete()
            .eq('user_id', user?.id)
            .eq('listing_id', listingId);
        
        if (!error) {
            setSavedItems(prev => prev.filter(i => i.listing_id !== listingId));
        }
    };

    const filteredItems = savedItems;

    return (
        <div className="saved-page animate-in">
            <div className="saved-container">
                <header className="saved-header">
                    <div className="saved-header-text">
                        <h1>Saved Items</h1>
                        <p>{savedItems.length} products carefully curated</p>
                    </div>
                </header>

                {isLoading ? (
                    <div className="saved-grid">
                        {Array(8).fill(0).map((_, i) => (
                            <div key={i} className="saved-skeleton-tile shimmer-effect" />
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="saved-empty-container animate-in">
                        <div className="empty-visual-ring">
                            <Heart size={32} />
                        </div>
                        <h2>Your list is currently empty</h2>
                        <p>Discover professional gear and curate your personal collection of industrial-grade tools.</p>
                        <Link to="/" className="saved-browse-link">
                            Explore Catalog
                        </Link>
                    </div>
                ) : (
                    <div className="saved-grid">
                        {filteredItems.map(item => (
                            <ProductCard 
                                key={item.id} 
                                item={item.listing} 
                                isSaved={true}
                                onToggleFavorite={(id) => unsaveItem(id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Saved;
