import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
    TrendingUp, 
    Eye, 
    Phone, 
    RefreshCcw, 
    ChevronRight,
    ArrowLeft,
    Package,
    Megaphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './Analytics.css';

interface ListingStats {
    id: string;
    title: string;
    images: string[];
    views: number;
    chats_count: number;
    calls_count: number;
    impressions_count: number;
    price: number;
}

const Analytics: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [listings, setListings] = useState<ListingStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalSummary, setTotalSummary] = useState({
        views: 0,
        phoneViews: 0,
        impressions: 0
    });
    const [trafficData, setTrafficData] = useState<number[]>([]);
    const [trafficLabels, setTrafficLabels] = useState<string[]>([]);

    useEffect(() => {
        if (user) fetchAnalytics();
    }, [user]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('listings')
                .select('id, title, images, views, chats_count, calls_count, impressions_count, price')
                .eq('user_id', user?.id)
                .order('views', { ascending: false });

            if (error) throw error;
            const typedData = data as ListingStats[];
            setListings(typedData);

            setTotalSummary({
                views: typedData.reduce((acc, curr) => acc + (curr.views || 0), 0),
                phoneViews: typedData.reduce((acc, curr) => acc + (curr.calls_count || 0), 0),
                impressions: typedData.reduce((acc, curr) => acc + (curr.impressions_count || 0), 0)
            });

            // Traffic Graph Logic (Last 10 days)
            const labels = [];
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 9);
            tenDaysAgo.setHours(0, 0, 0, 0);

            for (let i = 0; i < 10; i++) {
                const d = new Date(tenDaysAgo);
                d.setDate(d.getDate() + i);
                labels.push(d.toLocaleDateString('en-US', { weekday: 'narrow' }));
            }
            setTrafficLabels(labels);

            const { data: viewsHistory } = await supabase
                .from('viewed_listings')
                .select('viewed_at, listings!inner(user_id)')
                .eq('listings.user_id', user?.id)
                .gte('viewed_at', tenDaysAgo.toISOString());

            if (viewsHistory) {
                const counts = new Array(10).fill(0);
                viewsHistory.forEach(v => {
                    const viewDate = new Date(v.viewed_at);
                    const diffDays = Math.floor((viewDate.getTime() - tenDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays < 10) counts[diffDays]++;
                });
                setTrafficData(counts);
            } else {
                setTrafficData(new Array(10).fill(0));
            }
        } catch (err) {
            console.error('Analytics Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const renderGraph = () => {
        if (trafficData.length === 0) return null;
        const h = 100;
        const w = 300;
        const max = Math.max(...trafficData, 1);
        const step = w / (trafficData.length - 1);
        const points = trafficData.map((val, i) => ({
            x: i * step,
            y: h - (val / max) * (h - 20) - 10
        }));

        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const cp1x = p0.x + (p1.x - p0.x) / 2;
            d += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
        }

        return (
            <div className="analytics-svg-wrap">
                <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                    <motion.path
                        d={d}
                        fill="none"
                        stroke="#0057FF"
                        strokeWidth="3"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </svg>
                <div className="graph-labels-row">
                    {trafficLabels.map((l, i) => <span key={i}>{l}</span>)}
                </div>
            </div>
        );
    };

    if (isLoading) return <div className="analytics-loading">Loading Insights...</div>;

    return (
        <div className="analytics-page">
            <header className="analytics-header">
                <button className="back-btn-circle" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <h1>Store Performance</h1>
                <button className="refresh-btn-analytics" onClick={fetchAnalytics}>
                    <RefreshCcw size={18} />
                </button>
            </header>

            <div className="analytics-container-grid">
                {/* Traffic Highlight */}
                <section className="traffic-highlight-card">
                    <div className="card-top-info">
                        <div>
                            <h2>Visitor Traffic</h2>
                            <p>Last 10 Days</p>
                        </div>
                        <div className="trend-pillar">
                            <TrendingUp size={14} />
                            <span>Active</span>
                        </div>
                    </div>
                    {renderGraph()}
                </section>

                {/* Performance Summary Grid */}
                <div className="summary-tiles-grid">
                    <div className="summary-tile-box">
                        <div className="tile-icon eye"><Eye size={20} /></div>
                        <div className="tile-data">
                            <span className="tile-val">{totalSummary.views.toLocaleString()}</span>
                            <span className="tile-label">Total Views</span>
                        </div>
                    </div>
                    <div className="summary-tile-box">
                        <div className="tile-icon phone"><Phone size={20} /></div>
                        <div className="tile-data">
                            <span className="tile-val">{totalSummary.phoneViews}</span>
                            <span className="tile-label">Phone Leads</span>
                        </div>
                    </div>
                    <div className="summary-tile-box">
                        <div className="tile-icon megaphone"><Megaphone size={20} /></div>
                        <div className="tile-data">
                            <span className="tile-val">{totalSummary.impressions.toLocaleString()}</span>
                            <span className="tile-label">Discoveries</span>
                        </div>
                    </div>
                    <div className="summary-tile-box promo-tile">
                        <div className="tile-icon package"><Package size={20} /></div>
                        <div className="tile-data">
                            <span className="tile-val">{listings.length}</span>
                            <span className="tile-label">Active Shop</span>
                        </div>
                    </div>
                </div>

                {/* Product Performance List */}
                <section className="product-ranking-section">
                    <div className="section-header-analytics">
                        <h3>Inventory Performance</h3>
                        <p>Ranked by engagement</p>
                    </div>

                    <div className="ranking-list-wrap">
                        {listings.length === 0 ? (
                            <div className="empty-analytics">No listings found to analyze.</div>
                        ) : (
                            listings.map((item) => (
                                <div key={item.id} className="ranking-item-card" onClick={() => navigate(`/product/${item.id}`)}>
                                    <img src={item.images?.[0]} alt={item.title} className="ranking-img" />
                                    <div className="ranking-core">
                                        <h4>{item.title}</h4>
                                        <div className="micro-metrics">
                                            <div className="metric">
                                                <span className="m-val">{item.views}</span>
                                                <span className="m-lbl">Views</span>
                                            </div>
                                            <div className="metric-v-div" />
                                            <div className="metric">
                                                <span className="m-val">{item.chats_count || 0}</span>
                                                <span className="m-lbl">Chats</span>
                                            </div>
                                            <div className="metric-v-div" />
                                            <div className="metric">
                                                <span className="m-val">{item.calls_count || 0}</span>
                                                <span className="m-lbl">Calls</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="rank-chevron" />
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Analytics;
