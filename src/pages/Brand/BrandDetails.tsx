import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
    Search, 
    Filter, 
    ChevronDown, 
    Grid, 
    List,
    ArrowUpDown,
    LayoutGrid,
    Smartphone,
    Car,
    Home,
    Watch,
    Book,
    HeartPulse,
    Briefcase
} from 'lucide-react';
import ProductCard from '../../components/ProductCard/ProductCard';
import FilterModal, { Filters, DEFAULT_FILTERS, SORT_OPTIONS } from '../../components/FilterModal/FilterModal';
import { useDiscovery } from '../../context/DiscoveryContext';
import '../Category/Category.css';

const BrandDetails: React.FC = () => {
    const { brandName } = useParams<{ brandName: string }>();
    const [listings, setListings] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const { selectedLocation } = useDiscovery();

    const iconMap: { [key: string]: any } = {
        'Electronics': <Smartphone size={20} />,
        'Automotive': <Car size={20} />,
        'Home & Garden': <Home size={20} />,
        'Fashion & Beauty': <Watch size={20} />,
        'Books & Media': <Book size={20} />,
        'Health & Wellness': <HeartPulse size={20} />,
        'Business & Industrial': <Briefcase size={20} />,
        'All': <LayoutGrid size={20} />
    };

    const getIcon = (name: string) => iconMap[name] || <LayoutGrid size={20} color="#94a3b8" />;

    useEffect(() => {
        if (brandName) {
            fetchCategories();
            fetchListings();
        }
    }, [brandName, selectedCategory]);

    const fetchCategories = async () => {
        try {
            // Find categories that have products from this brand
            const { data } = await supabase
                .from('listings')
                .select('category')
                .eq('brand', brandName)
                .eq('status', 'approved');
            
            const uniqueCats = Array.from(new Set((data || []).map(l => l.category)));
            setCategories(['All', ...uniqueCats]);
        } catch (err) {
            console.error('Error fetching brand categories:', err);
        }
    };

    const fetchListings = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('listings').select('*').eq('brand', brandName).eq('status', 'approved');
            if (selectedCategory !== 'All') query = query.eq('category', selectedCategory);
            const { data } = await query.order('created_at', { ascending: false });
            setListings(data || []);
        } catch (err) {
            console.error('Error fetching brand listings:', err);
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
        
        // Sidebar Category
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

        // Modal filters
        const matchesCondition = filters.condition === 'All' || item.condition === filters.condition;
        const matchesMinPrice = !filters.priceMin || item.price >= parseFloat(filters.priceMin);
        const matchesMaxPrice = !filters.priceMax || item.price <= parseFloat(filters.priceMax);

        return matchesSearch && matchesCategory && matchesCondition && matchesMinPrice && matchesMaxPrice;
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
                        <span className="breadcrumb">Home / Brands / {brandName}</span>
                        <h1>{brandName}</h1>
                        <p>
                            {selectedLocation ? (
                                <>
                                    <strong style={{color: 'var(--accent-blue)'}}>{localCount} products found in {selectedLocation.name}</strong> • Showing {filteredListings.length} total
                                </>
                            ) : (
                                `${filteredListings.length} items available from this brand`
                            )}
                        </p>
                    </div>

                    <div className="cat-controls">
                        <div className="cat-search-box">
                            <Search size={18} />
                            <input 
                                type="text" 
                                placeholder={`Search in ${brandName}...`} 
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
                    {categories.map(cat => (
                        <div 
                            key={cat} 
                            className={`brand-item-v ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            <div className="brand-icon-wrap">
                                {getIcon(cat)}
                            </div>
                            <span>{cat}</span>
                        </div>
                    ))}
                </div>

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
                            <h2>No items found</h2>
                            <p>Try adjusting your search query within {brandName}.</p>
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
                    availableCategories={categories}
                />
            </div>
        </div>
    );
};

export default BrandDetails;
