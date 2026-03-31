import React, { useState, useEffect } from 'react';
import { X, Search, MapPin, ChevronRight } from 'lucide-react';
import LocationModal from '../LocationModal/LocationModal';
import './FilterModal.css';

export type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
export type ConditionOption = 'All' | 'Brand New' | 'Like New' | 'Used - Good' | 'Used - Fair';

export interface Filters {
    sort: SortOption;
    priceMin: string;
    priceMax: string;
    condition: ConditionOption;
    radius: string;
    brand: string;
    category: string;
}

export const DEFAULT_FILTERS: Filters = {
    sort: 'newest',
    priceMin: '',
    priceMax: '',
    condition: 'All',
    radius: 'Anywhere',
    brand: 'All',
    category: 'All',
};

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: Filters) => void;
    currentFilters: Filters;
    availableBrands?: string[];
    availableCategories?: string[];
}

export const SORT_OPTIONS: { label: string; value: SortOption }[] = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' },
    { label: 'Price: Low → High', value: 'price_asc' },
    { label: 'Price: High → Low', value: 'price_desc' },
];

const CONDITIONS: ConditionOption[] = ['Brand New', 'Like New', 'Used - Good', 'Used - Fair'];
const RADIUS_OPTIONS = ['5km', '10km', '25km', '50km', '100km'];

const FilterModal: React.FC<FilterModalProps> = ({ 
    isOpen, 
    onClose, 
    onApply, 
    currentFilters,
    availableBrands = [],
    availableCategories = []
}) => {
    const [filters, setFilters] = useState<Filters>(currentFilters);
    const [searchBrand, setSearchBrand] = useState('');
    const [isLocModalOpen, setIsLocModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFilters(currentFilters);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, currentFilters]);

    const handleReset = () => {
        setFilters(DEFAULT_FILTERS);
    };

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const filteredBrands = availableBrands.filter(b => 
        b.toLowerCase().includes(searchBrand.toLowerCase())
    );

    return (
        <div className={`filter-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
            <div className="filter-drawer-premium" onClick={e => e.stopPropagation()}>
                <header className="filter-header-premium">
                    <div className="filter-title-block">
                        <h2>More Filters</h2>
                        <p>Apply more criteria to find the perfect item.</p>
                    </div>
                    <button className="close-x-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </header>

                <div className="filter-body-premium">
                    {/* Sort Order */}
                    <section className="filter-section-premium">
                        <div className="section-head-row">
                            <h3>Sort Order</h3>
                            <button className="clear-link" onClick={() => setFilters({...filters, sort: 'newest'})}>Clear</button>
                        </div>
                        <div className="checkbox-group">
                            {SORT_OPTIONS.map(opt => (
                                <label key={opt.value} className="checkbox-item">
                                    <input 
                                        type="checkbox" 
                                        checked={filters.sort === opt.value}
                                        onChange={() => setFilters({...filters, sort: opt.value})}
                                    />
                                    <span className="checkbox-custom" />
                                    <span className="checkbox-label">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Price Range */}
                    <section className="filter-section-premium">
                        <div className="section-head-row">
                            <h3>Price Range</h3>
                            <button className="clear-link" onClick={() => setFilters({...filters, priceMin: '', priceMax: ''})}>Clear</button>
                        </div>
                        <div className="price-inputs-grid">
                            <div className="price-input-outline">
                                <span>Min</span>
                                <input 
                                    type="number" 
                                    placeholder="0"
                                    value={filters.priceMin}
                                    onChange={e => setFilters({...filters, priceMin: e.target.value})}
                                />
                            </div>
                            <div className="price-input-outline">
                                <span>Max</span>
                                <input 
                                    type="number" 
                                    placeholder="Any"
                                    value={filters.priceMax}
                                    onChange={e => setFilters({...filters, priceMax: e.target.value})}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Condition */}
                    <section className="filter-section-premium">
                        <div className="section-head-row">
                            <h3>Condition</h3>
                            <button className="clear-link" onClick={() => setFilters({...filters, condition: 'All'})}>Clear</button>
                        </div>
                        <div className="checkbox-group">
                            <label className="checkbox-item">
                                <input 
                                    type="checkbox" 
                                    checked={filters.condition === 'All'}
                                    onChange={() => setFilters({...filters, condition: 'All'})}
                                />
                                <span className="checkbox-custom" />
                                <span className="checkbox-label">All Conditions</span>
                            </label>
                            {CONDITIONS.map(cond => (
                                <label key={cond} className="checkbox-item">
                                    <input 
                                        type="checkbox" 
                                        checked={filters.condition === cond}
                                        onChange={() => setFilters({...filters, condition: cond})}
                                    />
                                    <span className="checkbox-custom" />
                                    <span className="checkbox-label">{cond}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Radius */}
                    <section className="filter-section-premium">
                        <div className="section-head-row">
                            <h3>Distance Radius</h3>
                            <button className="clear-link" onClick={() => setFilters({...filters, radius: 'Anywhere'})}>Clear</button>
                        </div>
                        <div className="checkbox-group">
                            <label className="checkbox-item">
                                <input 
                                    type="checkbox" 
                                    checked={filters.radius === 'Anywhere'}
                                    onChange={() => setFilters({...filters, radius: 'Anywhere'})}
                                />
                                <span className="checkbox-custom" />
                                <span className="checkbox-label">Anywhere</span>
                            </label>
                            {RADIUS_OPTIONS.map(rad => (
                                <label key={rad} className="checkbox-item">
                                    <input 
                                        type="checkbox" 
                                        checked={filters.radius === rad}
                                        onChange={() => setFilters({...filters, radius: rad})}
                                    />
                                    <span className="checkbox-custom" />
                                    <span className="checkbox-label">{rad}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Category Selection */}
                    {availableCategories.length > 0 && (
                        <section className="filter-section-premium">
                            <div className="section-head-row">
                                <h3>Category</h3>
                                <button className="clear-link" onClick={() => setFilters({...filters, category: 'All'})}>Clear</button>
                            </div>
                            <div className="checkbox-group scrollable">
                                <label className="checkbox-item">
                                    <input 
                                        type="checkbox" 
                                        checked={filters.category === 'All'}
                                        onChange={() => setFilters({...filters, category: 'All'})}
                                    />
                                    <span className="checkbox-custom" />
                                    <span className="checkbox-label">All Categories</span>
                                </label>
                                {availableCategories.map(cat => (
                                    <label key={cat} className="checkbox-item">
                                        <input 
                                            type="checkbox" 
                                            checked={filters.category === cat}
                                            onChange={() => setFilters({...filters, category: cat})}
                                        />
                                        <span className="checkbox-custom" />
                                        <span className="checkbox-label">{cat}</span>
                                    </label>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Location Section */}
                    <section className="filter-section-premium">
                        <div className="section-head-row">
                            <h3>Location</h3>
                        </div>
                        <button className="location-trigger-row" onClick={(e) => { e.preventDefault(); setIsLocModalOpen(true); }}>
                            <div className="loc-row-left">
                                <div className="loc-icon-bg">
                                    <MapPin size={18} color="#0057FF" />
                                </div>
                                <div className="loc-text-block">
                                    <span className="loc-label">Searching from</span>
                                    <p className="loc-name">{filters.radius === 'Anywhere' ? 'Current Location' : 'Selected Area'}</p>
                                </div>
                            </div>
                            <ChevronRight size={18} color="#94a3b8" />
                        </button>
                    </section>

                    {/* Brand Selection */}
                    {availableBrands.length > 0 && (
                        <section className="filter-section-premium">
                            <div className="section-head-row">
                                <h3>Brand</h3>
                                <button className="clear-link" onClick={() => setFilters({...filters, brand: 'All', category: 'All'})}>Clear</button>
                            </div>
                            <div className="section-search-bar">
                                <Search size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search brands..." 
                                    value={searchBrand}
                                    onChange={e => setSearchBrand(e.target.value)}
                                />
                            </div>
                            <div className="checkbox-group scrollable">
                                <label className="checkbox-item">
                                    <input 
                                        type="checkbox" 
                                        checked={filters.brand === 'All'}
                                        onChange={() => setFilters({...filters, brand: 'All'})}
                                    />
                                    <span className="checkbox-custom" />
                                    <span className="checkbox-label">All Brands</span>
                                </label>
                                {filteredBrands.map(brand => (
                                    <label key={brand} className="checkbox-item">
                                        <input 
                                            type="checkbox" 
                                            checked={filters.brand === brand}
                                            onChange={() => setFilters({...filters, brand: brand})}
                                        />
                                        <span className="checkbox-custom" />
                                        <span className="checkbox-label">{brand}</span>
                                    </label>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <footer className="filter-footer-premium">
                    <button className="clear-all-link" onClick={handleReset}>Clear all</button>
                    <button className="apply-btn-black" onClick={handleApply}>Apply</button>
                </footer>

                <LocationModal 
                    isOpen={isLocModalOpen}
                    onClose={() => setIsLocModalOpen(false)}
                    onSelect={(loc) => {
                        console.log('Location selected:', loc);
                    }}
                />
            </div>
        </div>
    );
};

export default FilterModal;
