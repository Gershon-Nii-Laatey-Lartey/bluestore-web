import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, Send, Image as ImageIcon, Paperclip, Phone, Info, User } from 'lucide-react';
import './Chat.css';

const ChatDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [otherUser, setOtherUser] = useState<any>(null);
    const [listing, setListing] = useState<any>(null);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!user || !id) return;
        fetchChatData();
        const subscription = setupSubscription();
        return () => {
            supabase.removeChannel(subscription);
        };
    }, [id, user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchChatData = async () => {
        try {
            // Fetch conversation details
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

            const other = convo.participants.find((p: any) => p.user.id !== user?.id)?.user;
            setOtherUser(other);
            setListing(convo.listing);

            // Fetch messages
            const { data: msgs, error: msgError } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', id)
                .order('created_at', { ascending: true });

            if (msgError) throw msgError;
            setMessages(msgs || []);
        } catch (err) {
            console.error('Error fetching chat detail:', err);
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
        if (!inputText.trim() || isSending || !user) return;

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
            console.error('Error sending message:', err);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="chat-detail-page">
            <header className="chat-detail-header">
                <button className="back-btn" onClick={() => navigate('/chat')}>
                    <ChevronLeft size={24} />
                </button>
                
                <div className="chat-header-user">
                    {otherUser?.avatar_url ? (
                        <img src={otherUser.avatar_url} alt="avatar" className="header-avatar" />
                    ) : (
                        <div className="header-avatar-placeholder"><User size={20} /></div>
                    )}
                    <div className="header-user-info">
                        <h3>{otherUser?.full_name || 'Bluestore User'}</h3>
                        <span className="online-status">Online</span>
                    </div>
                </div>

                <div className="header-actions">
                    <button className="action-btn"><Phone size={20} /></button>
                    <button className="action-btn"><Info size={20} /></button>
                </div>
            </header>

            {listing && (
                <div className="chat-listing-bar">
                    <img src={listing.images?.[0]} alt="listing" className="mini-listing-img" />
                    <div className="mini-listing-info">
                        <span className="mini-title">{listing.title}</span>
                        <span className="mini-price">GH₵{listing.price?.toLocaleString()}</span>
                    </div>
                    <button className="view-listing-btn" onClick={() => navigate(`/product/${listing.id}`)}>
                        View Item
                    </button>
                </div>
            )}

            <div className="messages-area">
                {messages.map((msg, index) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                        <div key={msg.id || index} className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
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

            <form className="chat-input-area" onSubmit={handleSend}>
                <div className="input-actions-left">
                    <button type="button" className="icon-btn"><Paperclip size={20} /></button>
                    <button type="button" className="icon-btn"><ImageIcon size={20} /></button>
                </div>
                <input 
                    type="text" 
                    placeholder="Type a message..." 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                />
                <button type="submit" className="send-btn" disabled={!inputText.trim() || isSending}>
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
};

export default ChatDetail;
