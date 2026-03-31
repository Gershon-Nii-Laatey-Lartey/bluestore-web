import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
    Search, 
    MessageSquare, 
    User, 
    Send,
    Paperclip,
    Phone,
    Info,
    MoreVertical
} from 'lucide-react';
import './Chat.css';

const Chat: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Master State
    const [conversations, setConversations] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingMaster, setIsLoadingMaster] = useState(true);

    // Detail State
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [otherUser, setOtherUser] = useState<any>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!user) return;
        fetchConversations();
    }, [user]);

    useEffect(() => {
        if (!user || !id) {
            setMessages([]);
            setOtherUser(null);
            return;
        }
        fetchChatDetail();
        const subscription = setupSubscription();
        return () => {
            supabase.removeChannel(subscription);
        };
    }, [id, user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchConversations = async () => {
        setIsLoadingMaster(true);
        try {
            const { data, error } = await supabase
                .from('conversation_participants')
                .select(`
                    conversation_id,
                    conversation:conversations(
                        *,
                        listing:listings(id, title, images),
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
            console.error('Master error:', err);
        } finally {
            setIsLoadingMaster(false);
        }
    };

    const fetchChatDetail = async () => {
        setIsLoadingDetail(true);
        try {
            const { data: convo, error: convoError } = await supabase
                .from('conversations')
                .select(`
                    *,
                    listing:listings(*),
                    participants:conversation_participants(
                        user:profiles(*)
                    )
                `)
                .eq('id', id)
                .single();

            if (convoError) throw convoError;

            // Find other participant
            const detailOther = convo.participants?.find((p: any) => p.user.id !== user?.id);
            setOtherUser(detailOther?.user);

            const { data: msgs, error: msgError } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', id)
                .order('created_at', { ascending: true });

            if (msgError) throw msgError;
            setMessages(msgs || []);
        } catch (err) {
            console.error('Detail error:', err);
        } finally {
            setIsLoadingDetail(false);
        }
    };

    const setupSubscription = () => {
        return supabase
            .channel(`convo:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${id}`,
            }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
            })
            .subscribe();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!inputText.trim() || !user || !id) return;

        const text = inputText.trim();
        setInputText('');
        setIsSending(true);

        try {
            const { error } = await supabase.from('messages').insert([{
                conversation_id: id,
                sender_id: user.id,
                text,
                message_type: 'text',
            }]);

            if (error) throw error;
        } catch (err) {
            console.error('Send error:', err);
        } finally {
            setIsSending(false);
        }
    };

    const filtered = conversations.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.listing?.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="chat-page">
            <aside className="chat-sidebar-master">
                <div className="chat-header-minimal">
                    <h1>Messages</h1>
                    <div className="chat-search-compact">
                        <Search size={16} color="#94a3b8" />
                        <input 
                            type="text" 
                            placeholder="Find chat or deal..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="chat-list-vcore">
                    {isLoadingMaster ? (
                        <>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="chat-item-master skeleton-item">
                                    <div className="master-avatar-hub skeleton" style={{ borderRadius: '12px' }}></div>
                                    <div className="master-content-box">
                                        <div className="master-row-top">
                                            <div className="skeleton" style={{ width: '60%', height: '14px', borderRadius: '4px' }}></div>
                                            <div className="skeleton" style={{ width: '20%', height: '10px', borderRadius: '4px' }}></div>
                                        </div>
                                        <div className="master-row-bottom" style={{ marginTop: '6px' }}>
                                            <div className="skeleton" style={{ width: '40%', height: '10px', borderRadius: '4px' }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : filtered.length === 0 ? (
                        <div className="chat-empty-master">
                            <MessageSquare size={32} color="#e2e8f0" />
                            <p>No matches found</p>
                        </div>
                    ) : (
                        filtered.map(convo => (
                            <div 
                                key={convo.id} 
                                className={`chat-item-master ${id === convo.id ? 'active' : ''}`}
                                onClick={() => navigate(`/chat/${convo.id}`)}
                            >
                                <div className="master-avatar-hub">
                                    {convo.listing?.images?.[0] ? (
                                        <img src={convo.listing.images[0]} alt="listing" className="m-listing-img" />
                                    ) : (
                                        <div className="m-listing-img"><User size={20} color="#94a3b8" /></div>
                                    )}
                                    <div className="m-user-overlay">
                                        {convo.avatar ? (
                                            <img src={convo.avatar} alt="user" />
                                        ) : (
                                            <div className="user-placeholder"><User size={10} color="#94a3b8" /></div>
                                        )}
                                    </div>
                                </div>
                                <div className="master-content-box">
                                    <div className="master-row-top">
                                        <span className="master-listing-title">{convo.listing?.title}</span>
                                        <span className="master-time">{convo.time}</span>
                                    </div>
                                    <div className="master-row-bottom">
                                        <span className="master-user-name">{convo.name}</span>
                                        <span className="master-msg-preview">{convo.lastMsg}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            <main className="chat-detail-content">
                {id ? (
                    isLoadingDetail ? (
                        <div className="chat-window-skeleton">
                            <header className="chat-window-header">
                                <div className="window-user-hub">
                                    <div className="window-avatar-mini skeleton" style={{ borderRadius: '50%' }}></div>
                                    <div className="window-user-text">
                                        <div className="skeleton" style={{ width: '120px', height: '14px', borderRadius: '4px', marginBottom: '4px' }}></div>
                                        <div className="skeleton" style={{ width: '60px', height: '10px', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            </header>
                            <div className="window-msg-area">
                                <div className="message-row theirs"><div className="message-bubble skeleton" style={{ width: '40%', height: '40px' }}></div></div>
                                <div className="message-row mine"><div className="message-bubble skeleton" style={{ width: '30%', height: '60px' }}></div></div>
                                <div className="message-row theirs"><div className="message-bubble skeleton" style={{ width: '50%', height: '40px' }}></div></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <header className="chat-window-header">
                                <div className="window-user-hub">
                                    {otherUser?.avatar_url ? (
                                        <img src={otherUser.avatar_url} alt="user" className="window-avatar-mini" />
                                    ) : (
                                        <div className="window-avatar-mini"><User size={18} /></div>
                                    )}
                                    <div className="window-user-text">
                                        <h3>{otherUser?.full_name || 'Bluestore Merchant'}</h3>
                                        <span>Active Discovery</span>
                                    </div>
                                </div>
                                <div className="window-header-actions">
                                    <button className="icon-action-btn"><Phone size={18} /></button>
                                    <button className="icon-action-btn"><Info size={18} /></button>
                                    <button className="icon-action-btn"><MoreVertical size={18} /></button>
                                </div>
                            </header>

                            <div className="window-msg-area">
                                {messages.map((msg, i) => {
                                    const isMine = msg.sender_id === user?.id;
                                    return (
                                        <div key={msg.id || i} className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
                                            <div className="message-bubble">
                                                <p>{msg.text}</p>
                                                <span className="message-time">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="window-input-box">
                                <form className="window-input-hub" onSubmit={handleSend}>
                                    <button type="button" className="icon-action-btn"><Paperclip size={18} /></button>
                                    <input 
                                        type="text" 
                                        placeholder="Type a discovery message..." 
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                    />
                                    <button type="submit" className="send-btn" disabled={!inputText.trim() || isSending}>
                                        <Send size={18} />
                                    </button>
                                </form>
                            </div>
                        </>
                    )
                ) : (
                    <div className="chat-empty-placeholder">
                        <div className="placeholder-icon-hub">
                            <MessageSquare size={32} />
                        </div>
                        <h2>Select a Discovery</h2>
                        <p>Open a conversation from the master list to continue your discovery journey.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Chat;
