import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Sparkles, ArrowRight, LayoutGrid, Smartphone, Laptop, Home as HomeIcon, Zap, Shirt, Car, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ProductCard from '../../components/ProductCard/ProductCard';
import './Home.css';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch Brands
        const { data: brandsData } = await supabase
          .from('brands')
          .select('*')
          .eq('is_featured', true)
          .order('sort_order', { ascending: true })
          .limit(10);
        if (brandsData) setBrands(brandsData);

        // Fetch Categories
        const { data: catsData } = await supabase
          .from('categories')
          .select('*')
          .limit(10);
          
        if (catsData) {
          const iconMap: any = {
            'Electronics': <Smartphone size={24} />,
            'Home': <HomeIcon size={24} />,
            'Tech': <Laptop size={24} />,
            'Style': <Shirt size={24} />,
            'Sport': <Zap size={24} />,
            'Vehicles': <Car size={24} />,
            'Properties': <Package size={24} />,
            'All': <LayoutGrid size={24} />,
            'More': <LayoutGrid size={24} />
          };

          setCategories([
            { name: 'More', label: 'More', icon: iconMap['More'], active: false },
            ...catsData.map((c: any) => ({ 
              ...c, 
              icon: iconMap[c.name] || <Package size={22} />,
              active: false 
            }))
          ]);
        }

        // Fetch Latest Listings
        const { data: listingsData } = await supabase
          .from('listings')
          .select('*')
          .eq('status', 'approved')
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20);
        if (listingsData) setListings(listingsData);

        // Fetch Recommendations (For You)
        const { data: recsData } = await supabase
          .from('listings')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: true })
          .limit(8);
        if (recsData) setRecommendations(recsData);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/search/${searchValue.trim()}`);
    }
  };

  return (
    <div className="content-container">
      {/* Mobile-Only Search Bar */}
      <div className="mobile-search-hub">
        <form className="m-search-box" onSubmit={handleSearchSubmit}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search premium collections..." 
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </form>
      </div>

      {/* Banner Section */}
      <section className="promo-banner">
        <div className="banner-content">
          <h1 className="banner-title">
            Clearance<br />Sales
          </h1>
          <div className="banner-badge">
            <span>🛍️ Up to 50% Off</span>
          </div>
          <Link to="/explore" className="banner-see-all">See all →</Link>
        </div>

        <div className="banner-image-container">
          <img
            src="/clearance.png"
            alt="Clearance Products"
            className="banner-image"
          />
        </div>
      </section>

      {/* Pop Brands */}
      {(isLoading || brands.length > 0) && (
        <section className="brands-section">
            <div className="section-header">
                <h2 className="section-title">Popular Brands</h2>
                {!isLoading && <Link to="/brands" className="see-all-link">See all →</Link>}
            </div>
            <div className="brands-grid horizontal-scroll-rail">
                {isLoading ? (
                    Array(8).fill(0).map((_, i) => (
                        <div key={i} className="brand-item">
                            <div className="brand-logo-wrap skeleton"></div>
                            <div className="skeleton-text-small skeleton"></div>
                        </div>
                    ))
                ) : (
                    brands.map((brand: any) => (
                        <Link to={`/category/All?brand=${brand.name}`} key={brand.id} className="brand-item">
                            <div className="brand-logo-wrap">
                                {brand.logo_url ? (
                                    <img src={brand.logo_url} alt={brand.name} />
                                ) : (
                                    <Sparkles size={24} />
                                )}
                            </div>
                            <span>{brand.name}</span>
                        </Link>
                    ))
                )}
            </div>
        </section>
      )}

      {/* Categories Section */}
      <section className="categories-section">
        <div className="section-header">
          <h2 className="section-title">Categories</h2>
          <Link to="/explore" className="see-all-link">
            <span>See all</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="categories-pills horizontal-scroll-rail">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="category-item-v skeleton" style={{ width: '80px', height: '100px', borderRadius: '16px' }}></div>
            ))
          ) : (
            categories.map((cat: any, idx: number) => (
              <Link
                key={idx}
                to={['All', 'More'].includes(cat.name) ? '/explore' : `/category/${cat.name}`}
                className={`category-item-v ${cat.active ? 'active' : ''}`}
              >
                <div className={`cat-icon-box ${cat.active ? 'active' : ''}`}>
                  {cat.icon}
                </div>
                <span className="cat-label">{cat.label || cat.name}</span>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Recommendations - For You Section */}
      {(isLoading || recommendations.length > 0) && (
        <section className="recommendations-section">
          <div className="section-header">
            <div className="title-group">
                <h2 className="section-title">For You</h2>
                <p className="section-subtitle">Picked based on your activity</p>
            </div>
          </div>
          <div className="horizontal-scroll-rail">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="recommendation-card">
                  <div className="rec-image-wrap skeleton"></div>
                  <div className="skeleton-text-small skeleton" style={{ width: '40%', marginBottom: '8px' }}></div>
                  <div className="skeleton-text-small skeleton" style={{ width: '80%', height: '20px', marginBottom: '8px' }}></div>
                  <div className="skeleton-text-small skeleton" style={{ width: '30%' }}></div>
                </div>
              ))
            ) : (
              recommendations.map((item: any) => (
                <Link to={`/product/${item.id}`} key={item.id} className="recommendation-card">
                   <div className="rec-image-wrap">
                      <img src={item.images?.[0]} alt={item.title} />
                      <div className="rec-badge">RELEVANT</div>
                   </div>
                   <span className="rec-brand">{item.brand || item.category}</span>
                   <h3 className="rec-title">{item.title}</h3>
                   <span className="rec-price">GH₵{item.price?.toLocaleString()}</span>
                </Link>
              ))
            )}
          </div>
        </section>
      )}

      {/* Latest Listings Section */}
      <section className="featured-section">
        <div className="section-header">
          <h2 className="section-title">Latest Listings</h2>
          <Link to="/explore" className="see-all-link">
            <span>See all</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
            <div className="product-grid">
                {Array(8).fill(0).map((_, i) => (
                    <div key={i} className="skeleton-card skeleton"></div>
                ))}
            </div>
        ) : listings.length === 0 ? (
            <div className="empty-state">
                <p className="empty-state-text">No products available. Start by publishing your first ad!</p>
            </div>
        ) : (
            <div className="product-grid">
                {listings.map((item: any) => (
                    <ProductCard key={item.id} item={item} />
                ))}
            </div>
        )}
      </section>
    </div>
  );
};

export default Home;
