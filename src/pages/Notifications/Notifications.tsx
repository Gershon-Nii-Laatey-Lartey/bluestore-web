import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
    Bell, 
    BellOff, 
    CheckCheck, 
    Trash2, 
    ChevronRight, 
    ShoppingBag, 
    Mail, 
    ShieldCheck, 
    Tag, 
    Star 
} from 'lucide-react';
import './Notifications.css';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    payload: any;
}

const Notifications: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) fetchNotifications();
    }, [user]);

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });
            
            setNotifications((data || []).filter(n => {
                if (n.type === 'listing_status' && n.payload?.status === 'pending') return false;
                return true;
            }));
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'listing_status': return { icon: <ShoppingBag size={20} />, color: '#0057FF', bg: '#F0F4FF' };
            case 'message': return { icon: <Mail size={20} />, color: '#FF9500', bg: '#FFF9F0' };
            case 'verification': return { icon: <ShieldCheck size={20} />, color: '#27AE60', bg: '#E0F9E9' };
            case 'offer': return { icon: <Tag size={20} />, color: '#AF52DE', bg: '#F8F0FF' };
            case 'review_request': return { icon: <Star size={20} />, color: '#FFB800', bg: '#FFFCEB' };
            default: return { icon: <Bell size={20} />, color: '#8A8A8A', bg: '#F5F5F5' };
        }
    };

    const markAsRead = async (id: string) => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (!error) setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const markAllRead = async () => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id).eq('is_read', false);
        if (!error) setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const deleteNotif = async (id: string) => {
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (!error) setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="notifications-page">
            <div className="notifications-container">
                <header className="notifications-header">
                    <div className="header-left">
                        <h1>Notifications</h1>
                        <p>{notifications.filter(n => !n.is_read).length} unread alerts</p>
                    </div>
                    <div className="header-actions">
                        <button className="icon-action-btn" title="Mark all as read" onClick={markAllRead}>
                            <CheckCheck size={20} />
                        </button>
                        <button className="icon-action-btn delete-all" title="Clear all">
                            <Trash2 size={20} />
                        </button>
                    </div>
                </header>

                <div className="notifications-list">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => <div key={i} className="notification-skeleton" />)
                    ) : notifications.length === 0 ? (
                        <div className="empty-notifications">
                            <div className="empty-icon-circle">
                                <BellOff size={48} />
                            </div>
                            <h3>All caught up!</h3>
                            <p>We'll notify you when something important happens.</p>
                        </div>
                    ) : (
                        notifications.map(n => {
                            const iconData = getIcon(n.type);
                            return (
                                <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`} onClick={() => markAsRead(n.id)}>
                                    <div className="notif-icon-box" style={{ background: iconData.bg, color: iconData.color }}>
                                        {iconData.icon}
                                    </div>
                                    <div className="notif-content">
                                        <div className="notif-top-row">
                                            <h4>{n.title}</h4>
                                            <span className="notif-time">{new Date(n.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p>{n.message}</p>
                                    </div>
                                    <div className="notif-actions">
                                        <button className="delete-notif-btn" onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}>
                                            <Trash2 size={16} />
                                        </button>
                                        <ChevronRight size={18} className="notif-chevron" />
                                    </div>
                                    {!n.is_read && <div className="unread-pulse-dot" />}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
