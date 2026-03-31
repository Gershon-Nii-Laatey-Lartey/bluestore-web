import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCheck, User, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Chat.css';

const ChatList: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!user) return;
        fetchConversations();
    }, [user]);

    const fetchConversations = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('conversation_participants')
                .select(`
                    conversation_id,
                    conversation:conversations(
                        *,
                        listing:listings(title, images),
                        participants:conversation_participants(
                            user:profiles(id, full_name, avatar_url)
                        )
                    )
                `)
                .eq('user_id', user?.id);

            if (error) throw error;

            const formatted = (data || []).map((p: any) => {
                const convo = p.conversation;
                if (!convo) return null;
                const other = convo.participants?.find((part: any) => part.user.id !== user?.id);
                return {
                    id: convo.id,
                    name: other?.user?.full_name || 'Bluestore User',
                    avatar: other?.user?.avatar_url,
                    lastMsg: convo.last_message || 'Start a conversation...',
                    time: new Date(convo.last_message_at || convo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    listing: convo.listing,
                    isRead: convo.last_message_is_read,
                    lastSenderId: convo.last_message_sender_id
                };
            }).filter(Boolean);

            setConversations(formatted);
        } catch (err) {
            console.error('Error fetching conversations:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filtered = conversations.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.listing?.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="chat-page">
            <div className="chat-header-main">
                <h1>Messages</h1>
                <div className="chat-search">
                    <Search size={18} />
                    <input 
                        type="text" 
                        placeholder="Search messages..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="chat-list">
                {isLoading ? (
                    <div className="chat-loading">Loading conversations...</div>
                ) : filtered.length === 0 ? (
                    <div className="chat-empty">
                        <MessageCircle size={48} />
                        <p>No messages yet</p>
                    </div>
                ) : (
                    filtered.map(convo => (
                        <div 
                            key={convo.id} 
                            className="chat-item"
                            onClick={() => navigate(`/chat/${convo.id}`)}
                        >
                            <div className="chat-avatar-stack">
                                {convo.listing?.images?.[0] ? (
                                    <img src={convo.listing.images[0]} alt="listing" className="listing-img" />
                                ) : (
                                    <div className="listing-placeholder"><User size={20} /></div>
                                )}
                                <div className="user-avatar-overlay">
                                    {convo.avatar ? (
                                        <img src={convo.avatar} alt="user" />
                                    ) : (
                                        <div className="user-placeholder"><User size={12} /></div>
                                    )}
                                </div>
                            </div>
                            <div className="chat-details">
                                <div className="chat-top">
                                    <span className="listing-title">{convo.listing?.title}</span>
                                    <span className="chat-time">{convo.time}</span>
                                </div>
                                <div className="chat-bottom">
                                    <span className="user-name">{convo.name}</span>
                                    <div className="msg-preview">
                                        {convo.lastSenderId === user?.id && (
                                            <CheckCheck size={14} color={convo.isRead ? '#00D1FF' : '#ABABAB'} />
                                        )}
                                        <span className="msg-text">{convo.lastMsg}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ChatList;
