import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
    Search, 
    MoreHorizontal, 
    Edit3, 
    CheckCircle, 
    Trash2, 
    RefreshCcw, 
    Plus, 
    Package, 
    LayoutGrid, 
    List,
    TrendingUp,
    ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './MyListings.css';

type LayoutType = 'list' | 'grid';

const MyListings: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [listings, setListings] = useState<any[]>([]);
    const [filteredListings, setFilteredListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [layout, setLayout] = useState<LayoutType>('list');
    const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        pending: 0,
        sold: 0
    });

    useEffect(() => {
        if (user) fetchMyListings();
    }, [user]);

    useEffect(() => {
        const filtered = listings.filter(item =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredListings(filtered);
    }, [searchQuery, listings]);

    const fetchMyListings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('listings')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const fetched = data || [];
            setListings(fetched);
            setFilteredListings(fetched);

            setStats({
                total: fetched.length,
                active: fetched.filter(l => l.status === 'approved').length,
                pending: fetched.filter(l => l.status === 'pending').length,
                sold: fetched.filter(l => l.status === 'closed').length
            });
        } catch (err) {
            console.error('Fetch MyListings Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (id: string, action: 'edit' | 'close' | 'delete' | 'republish') => {
        setSelectedListingId(null);
        try {
            if (action === 'edit') {
                navigate(`/edit/${id}`);
            } else if (action === 'close') {
                if (!window.confirm('Mark this item as sold?')) return;
                const { error } = await supabase
                    .from('listings')
                    .update({ status: 'closed' })
                    .eq('id', id);
                if (error) throw error;
                fetchMyListings();
            } else if (action === 'republish') {
                const { error } = await supabase
                    .from('listings')
                    .update({ status: 'approved' })
                    .eq('id', id);
                if (error) throw error;
                fetchMyListings();
            } else if (action === 'delete') {
                if (!window.confirm('Permanently delete this listing?')) return;
                const { error } = await supabase
                    .from('listings')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                fetchMyListings();
            }
        } catch (err: any) {
            alert(err.message || 'Action failed');
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'approved': return { label: 'Active', color: '#2E7D32', bg: '#E8F5E9' };
            case 'pending': return { label: 'Reviewing', color: '#EF6C00', bg: '#FFF3E0' };
            case 'closed': 
            case 'sold': return { label: 'Sold', color: '#616161', bg: '#F5F5F5' };
            default: return { label: status || 'Unknown', color: '#9E9E9E', bg: '#F5F5F5' };
        }
    };

    if (isLoading) return <div className="ml-loading-state">Syncing Store Inventory...</div>;

    return (
        <div className="my-listings-page">
            <header className="ml-main-header">
                <div className="ml-header-left">
                    <button className="back-btn-ml" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
                    <div>
                        <h1>My Listings</h1>
                        <p>{stats.total} total items listed</p>
                    </div>
                </div>
                <button className="ml-add-item-btn" onClick={() => navigate('/publish')}>
                    <Plus size={20} />
                    <span>Post New Ad</span>
                </button>
            </header>

            <div className="ml-content-container">
                {/* Dynamic Filters & Search */}
                <section className="ml-controls-row">
                    <div className="ml-search-box">
                        <Search size={18} color="#ABABAB" />
                        <input 
                            type="text" 
                            placeholder="Search your inventory..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="ml-view-toggle">
                        <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}><List size={18} /></button>
                        <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}><LayoutGrid size={18} /></button>
                    </div>
                </section>

                {/* Performance Summary Bar */}
                <div className="ml-stats-summary">
                    <div className="ml-stat-chip active">
                        <span className="ml-stat-val">{stats.active}</span>
                        <span className="ml-stat-lbl">Active</span>
                    </div>
                    <div className="ml-stat-chip pending">
                        <span className="ml-stat-val">{stats.pending}</span>
                        <span className="ml-stat-lbl">Pending</span>
                    </div>
                    <div className="ml-stat-chip sold">
                        <span className="ml-stat-val">{stats.sold}</span>
                        <span className="ml-stat-lbl">Sold</span>
                    </div>
                </div>

                {/* Listings Display Area */}
                <div className={`ml-inventory-wrapper layout-${layout}`}>
                    {filteredListings.length === 0 ? (
                        <div className="ml-empty-state">
                            <div className="empty-icon-circle"><Package size={40} /></div>
                            <h3>Store Inventory Empty</h3>
                            <p>You haven't listed any items matching "{searchQuery}"</p>
                        </div>
                    ) : (
                        filteredListings.map(item => {
                            const status = getStatusInfo(item.status);
                            
                            if (layout === 'grid') {
                                return (
                                    <div key={item.id} className="ml-grid-card">
                                        <div className="ml-grid-img-area">
                                            <img src={item.images?.[0]} alt={item.title} />
                                            <div className="ml-status-pill" style={{ backgroundColor: status.bg, color: status.color }}>
                                                {status.label}
                                            </div>
                                            {item.is_boosted && <div className="ml-boost-badge"><TrendingUp size={10} /> BOOSTED</div>}
                                            <button className="ml-grid-menu-btn" onClick={() => setSelectedListingId(selectedListingId === item.id ? null : item.id)}>
                                                <MoreHorizontal size={18} />
                                            </button>
                                            
                                            {selectedListingId === item.id && (
                                                <div className="ml-grid-menu-dropdown">
                                                    <button onClick={() => handleAction(item.id, 'edit')}><Edit3 size={14} /> Edit</button>
                                                    {item.status === 'approved' && <button onClick={() => handleAction(item.id, 'close')}><CheckCircle size={14} /> Sold</button>}
                                                    {item.status === 'closed' && <button onClick={() => handleAction(item.id, 'republish')}><RefreshCcw size={14} /> Relist</button>}
                                                    <button className="del" onClick={() => handleAction(item.id, 'delete')}><Trash2 size={14} /> Delete</button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-grid-info">
                                            <h4>{item.title}</h4>
                                            <p>GH₵ {parseFloat(item.price).toLocaleString()}</p>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={item.id} className="ml-list-card">
                                    <div className="ml-list-img-box">
                                        <img src={item.images?.[0]} alt={item.title} />
                                    </div>
                                    <div className="ml-list-main-info">
                                        <div className="ml-list-header">
                                            <div className="ml-list-title-block">
                                                <h4>{item.title}</h4>
                                                <span className="ml-list-price">GH₵ {parseFloat(item.price).toLocaleString()}</span>
                                            </div>
                                            <div className="ml-list-actions-desktop">
                                                <button className="ml-action-btn-icon edit" onClick={() => handleAction(item.id, 'edit')} title="Edit"><Edit3 size={16} /></button>
                                                {item.status === 'approved' && <button className="ml-action-btn-icon sold" onClick={() => handleAction(item.id, 'close')} title="Mark Sold"><CheckCircle size={16} /></button>}
                                                {item.status === 'closed' && <button className="ml-action-btn-icon relist" onClick={() => handleAction(item.id, 'republish')} title="List Again"><RefreshCcw size={16} /></button>}
                                                <button className="ml-action-btn-icon delete" onClick={() => handleAction(item.id, 'delete')} title="Delete"><Trash2 size={16} /></button>
                                            </div>
                                            <button className="ml-list-mobile-menu" onClick={() => setSelectedListingId(selectedListingId === item.id ? null : item.id)}>
                                                <MoreHorizontal size={20} />
                                            </button>
                                        </div>

                                        <div className="ml-list-footer">
                                            <div className="ml-status-pill" style={{ backgroundColor: status.bg, color: status.color }}>
                                                {status.label}
                                            </div>
                                            <span className="ml-list-date">{new Date(item.created_at).toLocaleDateString()}</span>
                                            {item.is_boosted && <div className="ml-boost-badge-list"><TrendingUp size={10} /> BOOSTED</div>}
                                        </div>

                                        {selectedListingId === item.id && (
                                            <div className="ml-mobile-action-bar">
                                                <button onClick={() => handleAction(item.id, 'edit')}><Edit3 size={14} /> Edit</button>
                                                {item.status === 'approved' && <button onClick={() => handleAction(item.id, 'close')}><CheckCircle size={14} /> Sold</button>}
                                                {item.status === 'closed' && <button onClick={() => handleAction(item.id, 'republish')}><RefreshCcw size={14} /> Relist</button>}
                                                <button className="del" onClick={() => handleAction(item.id, 'delete')}><Trash2 size={14} /> Delete</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyListings;
