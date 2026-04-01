import React from 'react';
import { Link } from 'react-router-dom';
import { 
    Heart, 
    Zap,
    Image as ImageIcon
} from 'lucide-react';
import './ProductCard.css';

interface ProductCardProps {
    item: {
        id: string;
        title: string;
        price: number;
        images?: string[];
        condition: string;
        location?: string;
        is_boosted?: boolean;
    };
    isSaved?: boolean;
    onToggleFavorite?: (id: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ item, isSaved, onToggleFavorite }) => {
    return (
        <Link to={`/product/${item.id}`} className="um-card-anchor">
            <div className="ultra-minimal-card">
                <div className="um-card-image">
                    <div className="um-tag-condition">
                        {item.condition === 'Brand New' ? 'NEW' : 'USED'}
                    </div>

                    {item.is_boosted && (
                        <div className="um-tag-boosted">
                            <Zap size={10} fill="#FFF" color="#FFF" />
                            <span>BOOSTED</span>
                        </div>
                    )}

                    {item.images && item.images[0] ? (
                        <img src={item.images[0]} alt={item.title} className="product-img-main" />
                    ) : (
                        <div className="image-placeholder-icon">
                            <ImageIcon size={32} color="#EBEBEB" />
                        </div>
                    )}

                    {onToggleFavorite && (
                        <button 
                            className={`um-fav-btn ${isSaved ? 'is-saved' : ''}`} 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleFavorite(item.id);
                            }}
                        >
                            <Heart size={16} fill={isSaved ? "#FF4B4B" : "none"} color={isSaved ? "#FF4B4B" : "#111111"} />
                        </button>
                    )}
                </div>

                <div className="um-card-content">
                    <h3 className="um-title">{item.title}</h3>
                    <div className="um-price">GHS {item.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="um-location-wrap">
                        <span>{item.location || 'Accra, Greater Accra Region'}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default ProductCard;
