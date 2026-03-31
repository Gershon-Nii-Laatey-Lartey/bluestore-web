import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Clock, Image as ImageIcon } from 'lucide-react';
import './Explore.css';

const Explore: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<any[]>([]);
    const [recentSearches] = useState<string[]>(['iPhone 15', 'MacBook Pro', 'Nike Jordans', 'Gaming PCs']);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

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

    return (
        <div className="explore-page">
            <header className="explore-header">
                <div className="explore-title-group">
                    <h1>Explore Bluestore</h1>
                    <p>Find the best deals across Nigeria's largest industrial marketplace.</p>
                </div>
                
                <div className="search-hub-minimal">
                    <Search className="search-hub-icon" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search items, brands, sellers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="recent-searches-minimal">
                    {recentSearches.map((tag, idx) => (
                        <div key={idx} className="search-pill-mini">
                            {tag}
                        </div>
                    ))}
                </div>
            </header>

            <main className="explore-grid-container">
                <h2>Browse Categories</h2>
                
                <div className="category-mini-grid">
                    {isLoading ? (
                        Array(12).fill(0).map((_, i) => (
                            <div key={i} className="skeleton-cat-mini skeleton"></div>
                        ))
                    ) : (
                        categories.map(cat => (
                            <div key={cat.id} className="category-mini-card">
                                <h3>{cat.name}</h3>
                                <span>{Math.floor(Math.random() * 50) + 10} Listings</span>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default Explore;
