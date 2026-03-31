import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
    Search, 
    Filter, 
    Grid, 
    List,
    LayoutGrid
} from 'lucide-react';
import ProductCard from '../../components/ProductCard/ProductCard';
import FilterModal, { Filters, DEFAULT_FILTERS, SORT_OPTIONS } from '../../components/FilterModal/FilterModal';
import { useDiscovery } from '../../context/DiscoveryContext';
import './Category.css';

const Category: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [listings, setListings] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { selectedLocation } = useDiscovery();
    const [selectedBrand, setSelectedBrand] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (id) {
            fetchBrands();
            fetchListings();
        }
    }, [id, selectedBrand]);

    const fetchBrands = async () => {
        try {
            const { data: catData } = await supabase.from('categories').select('id').eq('name', id).single();
            if (catData) {
                const { data } = await supabase
                    .from('category_brands')
                    .select('brands(*)')
                    .eq('category_id', catData.id);
                const fetched = (data || []).map((b: any) => b.brands).filter(Boolean);
                setBrands([{ name: 'All' }, ...fetched]);
            }
        } catch (err) {
            console.error('Error fetching brands:', err);
        }
    };

    const fetchListings = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('listings').select('*').eq('category', id).eq('status', 'approved');
            if (selectedBrand !== 'All') query = query.eq('brand', selectedBrand);
            const { data } = await query.order('created_at', { ascending: false });
            setListings(data || []);
        } catch (err) {
            console.error('Error fetching listings:', err);
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
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBrand = selectedBrand === 'All' || item.brand === selectedBrand;
        
        const matchesCondition = filters.condition === 'All' || item.condition === filters.condition;
        const matchesMinPrice = !filters.priceMin || item.price >= parseFloat(filters.priceMin);
        const matchesMaxPrice = !filters.priceMax || item.price <= parseFloat(filters.priceMax);

        return matchesSearch && matchesBrand && matchesCondition && matchesMinPrice && matchesMaxPrice;
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
                        <span className="breadcrumb">Home / Categories / {id}</span>
                        <h1>{id}</h1>
                        <p>
                            {selectedLocation ? (
                                <>
                                    <strong style={{color: 'var(--accent-blue)'}}>{localCount} products found in {selectedLocation.name}</strong> • Showing {filteredListings.length} total
                                </>
                            ) : (
                                `${filteredListings.length} items available in this category`
                            )}
                        </p>
                    </div>

                    <div className="cat-controls">
                        <div className="cat-search-box">
                            <Search size={18} />
                            <input 
                                type="text" 
                                placeholder={`Search in ${id}...`} 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className="filter-trigger-btn" onClick={() => setIsFilterOpen(true)}>
                            <Filter size={18} />
                            <span>Filters</span>
                        </button>
                    </div>
                </header>

                <div className="brand-strip-premium">
                    {brands.map(brand => (
                        <div 
                            key={brand.name} 
                            className={`brand-item-v ${selectedBrand === brand.name ? 'active' : ''}`}
                            onClick={() => setSelectedBrand(brand.name)}
                        >
                            <div className="brand-icon-wrap">
                                {brand.logo_url ? <img src={brand.logo_url} alt="" /> : <LayoutGrid size={20} color="#94a3b8" />}
                            </div>
                            <span>{brand.name}</span>
                        </div>
                    ))}
                </div>

                <div className="inventory-view-controls">
                    <div className="sort-dropdown" onClick={() => setIsFilterOpen(true)}>
                        <span>Sort By: </span>
                        <strong>{SORT_OPTIONS.find(o => o.value === filters.sort)?.label}</strong>
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

                <div className={`category-inventory-grid ${viewMode}`}>
                    {isLoading ? (
                        Array(8).fill(0).map((_, i) => <div key={i} className="inventory-card-skeleton" />)
                    ) : rankedListings.length === 0 ? (
                        <div className="empty-category">
                            <h2>No items found</h2>
                            <p>Try adjusting your filters or search query.</p>
                        </div>
                    ) : (
                        rankedListings.map(listing => (
                            <ProductCard 
                                key={listing.id} 
                                item={listing} 
                            />
                        ))
                    )}
                </div>

                <FilterModal 
                    isOpen={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                    onApply={handleApplyFilters}
                    currentFilters={filters}
                    availableBrands={brands.map(b => b.name).filter(Boolean)}
                />
            </div>
        </div>
    );
};

export default Category;
