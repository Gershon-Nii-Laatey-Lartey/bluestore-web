import React from 'react';
import { ArrowRight } from 'lucide-react';
import './ContentSections.css';

const ContentSections: React.FC = () => {
  const categories = [
    { label: 'All', active: true },
    { label: 'Automotive', active: false },
    { label: 'Books & Media', active: false },
    { label: 'Business & Industrial', active: false },
    { label: 'Electronics', active: false },
    { label: 'Fashion & Beauty', active: false },
    { label: 'Health & Wellness', active: false },
    { label: 'Home & Garden', active: false }
  ];

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
          {categories.map((cat, idx) => (
            <div
              key={idx}
              className={`category-pill ${cat.active ? 'active' : ''}`}
            >
              {cat.label}
            </div>
          ))}
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="featured-section">
        <div className="section-header">
          <h2 className="section-title">Featured Products</h2>
          <a href="#" className="see-all-link">
            <span>See all</span>
            <ArrowRight size={14} />
          </a>
        </div>

        <div className="empty-state">
          <p className="empty-state-text">No products available. Start by publishing your first ad!</p>
        </div>
      </section>
    </div>
  );
};

export default ContentSections;
