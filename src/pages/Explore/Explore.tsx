import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import ProductCard from '../../components/ProductCard/ProductCard';
import './Explore.css';

const Explore: React.FC = () => {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<any[]>([]);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [recentViews, setRecentViews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
        fetchSearchHistory();
        fetchViewHistory();
    }, [user]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('categories')
                .select('*')
                .order('name');
            if (data) setCategories(data);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSearchHistory = async () => {
        try {
          if (user) {
            const { data } = await supabase
              .from('search_history')
              .select('query')
              .eq('user_id', user.id)
              .order('searched_at', { ascending: false })
              .limit(8);
            if (data) setSearchHistory(data.map(h => h.query));
          } else {
            const saved = localStorage.getItem('@local_search_history');
            if (saved) setSearchHistory(JSON.parse(saved).slice(0, 8));
          }
        } catch (err) {
          console.error('History fetch error:', err);
        }
    };

    const fetchViewHistory = async () => {
        try {
          if (user) {
            const { data } = await supabase
              .from('viewed_listings')
              .select('viewed_at, listing:listings(*)')
              .eq('user_id', user.id)
              .order('viewed_at', { ascending: false })
              .limit(10);
            if (data) setRecentViews(data.map((h: any) => h.listing).filter(Boolean));
          } else {
            const LOCAL_VIEWS_KEY = '@local_viewed_listings';
            const local = localStorage.getItem(LOCAL_VIEWS_KEY);
            if (!local) return;
            const entries = JSON.parse(local);
            const ids = entries.map((v: any) => v.listing_id);
            
            // Batch fetch details for guest users matching mobile app implementation
            const { data } = await supabase
                .from('listings')
                .select('*')
                .in('id', ids);
            
            if (data) {
                // Ensure correct chronological order as in local storage
                const ordered = ids.map((id: string) => data.find(item => item.id === id)).filter(Boolean);
                setRecentViews(ordered);
            }
          }
        } catch (err) {
          console.error('View history sync error:', err);
        }
    };

    return (
        <div className="explore-page">
            <header className="explore-header">
                {/* Search Bar - First Position */}
                <div className="search-hub-minimal">
                    <Search className="search-hub-icon" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search items, brands, sellers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Actual Search History */}
                {searchHistory.length > 0 && (
                    <div className="search-history-container">
                        <div className="section-header-row">
                            <h2 className="mini-title-v">Recent Search</h2>
                            <Link to="/search-history" className="see-all-v">See all</Link>
                        </div>
                        <div className="recent-searches-minimal">
                            {searchHistory.map((tag, idx) => (
                                <Link to={`/search/${tag}`} key={idx} className="search-pill-mini">
                                    {tag}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            <main className="explore-content-body">
                {/* View History - Under Search History */}
                {recentViews.length > 0 && (
                    <section className="explore-section">
                        <div className="section-header-row">
                            <h2 className="mini-title-v">Recent Viewed</h2>
                            <Link to="/saved" className="see-all-v">See all</Link>
                        </div>
                        <div className="view-history-rail horizontal-scroll-rail">
                            {recentViews.map(item => (
                                <ProductCard key={item.id} item={item} />
                            ))}
                        </div>
                    </section>
                )}

                <section className="explore-section">
                    <h2 className="explore-section-title">Browse Categories</h2>
                    <div className="category-mini-grid">
                        {isLoading ? (
                            Array(12).fill(0).map((_, i) => (
                                <div key={i} className="skeleton-cat-mini skeleton"></div>
                            ))
                        ) : (
                            categories.map(cat => (
                                <Link to={`/category/${cat.name}`} key={cat.id} className="category-mini-card">
                                    <h3>{cat.name}</h3>
                                    <span>Browse Inventory</span>
                                </Link>
                            ))
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Explore;
