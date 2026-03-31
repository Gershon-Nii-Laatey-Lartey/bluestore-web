import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../../components/ProductCard/ProductCard';
import { supabase } from '../../lib/supabase';
import './Home.css';

const Home: React.FC = () => {
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          .limit(12);
        if (catsData) {
          setCategories([{ name: 'All', active: true }, ...catsData.map(c => ({ ...c, active: false }))]);
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

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  return (
    <div className="content-container">
      {/* Banner Section */}
      <section className="promo-banner">
        <div className="banner-content">
          <h1 className="banner-title">
            Clearance<br />Sales
          </h1>
          <div className="banner-badge">
            <span>🛍️ Up to 50% Off</span>
          </div>
          <a href="#" className="banner-see-all">See all →</a>
        </div>

        <div className="banner-image-container">
          <img
            src="/clearance.png"
            alt="Clearance Products"
            className="banner-image"
          />
        </div>
      </section>

      {/* Pop Brands - Ported from Mobile */}
      {brands.length > 0 && (
        <section className="brands-section">
            <div className="section-header">
                <h2 className="section-title">Popular Brands</h2>
                <a href="/brands" className="see-all-link">See all →</a>
            </div>
            <div className="brands-grid">
                {isLoading ? (
                    Array(8).fill(0).map((_, i) => (
                        <div key={i} className="brand-item">
                            <div className="brand-logo-wrap skeleton"></div>
                            <div className="skeleton-text-small skeleton"></div>
                        </div>
                    ))
                ) : (
                    brands.map((brand) => (
                        <Link to={`/brand/${brand.name}`} key={brand.id} className="brand-item">
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
          <a href="#" className="see-all-link">
            <span>See all</span>
            <ArrowRight size={14} />
          </a>
        </div>

        <div className="categories-pills">
          {(categories.length > 0 ? categories : [
                { name: 'All', active: true },
                { name: 'Automotive', active: false },
                { name: 'Books & Media', active: false },
                { name: 'Business & Industrial', active: false },
                { name: 'Electronics', active: false },
                { name: 'Fashion & Beauty', active: false },
                { name: 'Health & Wellness', active: false },
                { name: 'Home & Garden', active: false }
          ]).map((cat, idx) => (
            <Link
              key={idx}
              to={cat.name === 'All' ? '/explore' : `/category/${cat.name}`}
              className={`category-pill ${cat.active ? 'active' : ''}`}
            >
              {cat.label || cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="featured-section">
        <div className="section-header">
          <h2 className="section-title">Latest Listings</h2>
          <a href="#" className="see-all-link">
            <span>See all</span>
            <ArrowRight size={14} />
          </a>
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
                {listings.map((item) => (
                    <ProductCard key={item.id} item={item} />
                ))}
            </div>
        )}
      </section>
    </div>
  );
};

export default Home;
