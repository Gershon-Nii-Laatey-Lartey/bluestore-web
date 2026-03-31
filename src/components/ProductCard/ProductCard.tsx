import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import './ProductCard.css';

interface ProductCardProps {
    item: any;
    isSaved?: boolean;
    onUnsave?: (e: React.MouseEvent) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ item, isSaved, onUnsave }) => {
    return (
        <Link to={`/product/${item.id}`} className="ultra-minimal-card">
            <div className="um-card-image">
                <img src={item.images?.[0] || 'https://via.placeholder.com/300'} alt={item.title} />
                
                <div className="um-badge-stack">
                    {item.is_boosted && <span className="um-badge boosted">Boosted</span>}
                    {item.is_urgent && <span className="um-badge urgent">Urgent</span>}
                </div>

                {isSaved && onUnsave && (
                    <button className="um-fav-btn" onClick={onUnsave}>
                        <Heart size={16} fill="#ff4757" color="#ff4757" />
                    </button>
                )}
            </div>
            <div className="um-card-content">
                <h3 className="um-title">{item.title}</h3>
                <div className="um-price">GH₵ {item.price.toLocaleString()}</div>
                <div className="um-location-wrap">
                    <span>{item.location || 'Accra, Greater Accra Region'}</span>
                </div>
            </div>
        </Link>
    );
};

export default ProductCard;
