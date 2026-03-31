import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
    Filter, 
    Grid, 
    List,
    ArrowUpDown,
    ChevronDown
} from 'lucide-react';
import ProductCard from '../../components/ProductCard/ProductCard';
import FilterModal, { Filters, DEFAULT_FILTERS, SORT_OPTIONS } from '../../components/FilterModal/FilterModal';
import { useDiscovery } from '../../context/DiscoveryContext';
import '../Category/Category.css';

const SearchResults: React.FC = () => {
    const { query } = useParams<{ query: string }>();
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { selectedLocation } = useDiscovery();

    useEffect(() => {
        if (query) fetchResults();
    }, [query]);

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('listings')
                .select('*')
                .or(`title.ilike.%${query}%,category.ilike.%${query}%,brand.ilike.%${query}%`)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setListings(data || []);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFilters = (newFilters: Filters) => {
        setFilters(newFilters);
        console.log('Applying filters:', newFilters);
    };

    const sortedListings = [...listings].sort((a, b) => {
        if (filters.sort === 'price_asc') return a.price - b.price;
        if (filters.sort === 'price_desc') return b.price - a.price;
        if (filters.sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const filteredListings = sortedListings.filter(item => {
        const matchesCondition = filters.condition === 'All' || item.condition === filters.condition;
        const matchesMinPrice = !filters.priceMin || item.price >= parseFloat(filters.priceMin);
        const matchesMaxPrice = !filters.priceMax || item.price <= parseFloat(filters.priceMax);

        return matchesCondition && matchesMinPrice && matchesMaxPrice;
    });

    // Re-rank based on location: matching location first
    const rankedListings = [...filteredListings].sort((a, b) => {
        if (!selectedLocation) return 0;
        const aMatches = a.location?.toLowerCase().includes(selectedLocation.name.toLowerCase());
        const bMatches = b.location?.toLowerCase().includes(selectedLocation.name.toLowerCase());
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
    });

    const localCount = filteredListings.filter(item => 
        selectedLocation && item.location?.toLowerCase().includes(selectedLocation.name.toLowerCase())
    ).length;

    return (
        <div className="category-page">
            <div className="category-container">
                <header className="category-header-premium">
                    <div className="cat-header-text">
                        <span className="breadcrumb">Search / "{query}"</span>
                        <h1>Search Results</h1>
                        <p>
                            {selectedLocation ? (
                                <>
                                    <strong style={{color: 'var(--accent-blue)'}}>{localCount} products found in {selectedLocation.name}</strong> • Showing {filteredListings.length} total
                                </>
                            ) : (
                                `${filteredListings.length} items found for your request`
                            )}
                        </p>
                    </div>

                    <div className="cat-controls">
                        <button className="filter-trigger-btn" onClick={() => setIsFilterOpen(true)}>
                            <Filter size={18} />
                            <span>Filters</span>
                        </button>
                    </div>
                </header>

                <div className="inventory-view-controls full-width">
                    <div className="sort-dropdown" onClick={() => setIsFilterOpen(true)}>
                        <ArrowUpDown size={16} />
                        <span>Sort by: {SORT_OPTIONS.find(o => o.value === filters.sort)?.label}</span>
                        <ChevronDown size={14} />
                    </div>
                    <div className="view-mode-toggle">
                        <button 
                            className={viewMode === 'grid' ? 'active' : ''} 
                            onClick={() => setViewMode('grid')}
                        >
                            <Grid size={18} />
                        </button>
                        <button 
                            className={viewMode === 'list' ? 'active' : ''} 
                            onClick={() => setViewMode('list')}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                <div className={`category-inventory-grid full-width ${viewMode}`}>
                    {isLoading ? (
                        Array(8).fill(0).map((_, i) => <div key={i} className="inventory-card-skeleton" />)
                    ) : rankedListings.length === 0 ? (
                        <div className="empty-category">
                            <h2>No matches found</h2>
                            <p>Try refining your categories or refining your keyword.</p>
                        </div>
                    ) : (
                        rankedListings.map(item => (
                            <ProductCard key={item.id} item={item} />
                        ))
                    )}
                </div>

                <FilterModal 
                    isOpen={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                    onApply={handleApplyFilters}
                    currentFilters={filters}
                />
            </div>
        </div>
    );
};

export default SearchResults;
