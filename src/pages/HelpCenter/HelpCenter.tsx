import React, { useState } from 'react';
import { ArrowLeft, Search, ChevronDown, ChevronUp, Mail, MessageCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './HelpCenter.css';

const FAQ_DATA = [
    {
        question: 'How do I buy an item?',
        answer: 'To buy an item, browse through the listings, select a product you like, and use the "Chat" or "Call" button to contact the seller directly. Bluestore currently facilitates direct connections between buyers and sellers.',
    },
    {
        question: 'Is it free to list an item?',
        answer: 'Yes! Basic listings on Bluestore are currently free for all users. You can upload up to 10 photos and provide a detailed description for each item.',
    },
    {
        question: 'How do I edit my listing?',
        answer: 'Go to your Profile, tap on "My Listings," select the item you want to change, and tap the edit icon (pencil) in the top right corner.',
    },
    {
        question: 'What is a "Verified Seller"?',
        answer: 'Verified Sellers are users who have completed our identity verification process. This badge helps build trust within the community.',
    },
    {
        question: 'How can I report a scam?',
        answer: 'If you encounter a suspicious listing or user, please use the "Report" button on the product page or contact our support team immediately through the options below.',
    },
];

const HelpCenter: React.FC = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [isLoading] = useState(false);

    const filteredFaqs = FAQ_DATA.filter(faq =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="help-page-skeleton">
                <div className="hp-header-skeleton shimmer"></div>
                <div className="hp-search-skeleton shimmer"></div>
                <div className="hp-list-skeleton">
                    {[1, 2, 3, 4].map(i => <div key={i} className="hp-item-skeleton shimmer"></div>)}
                </div>
            </div>
        );
    }

    return (
        <div className="help-center-page">
            <header className="hp-header">
                <button className="hp-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <h1>Help Center</h1>
                <div style={{ width: 44 }}></div>
            </header>

            <div className="hp-container">
                <div className="hp-search-wrapper">
                    <Search size={20} className="hp-search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search help articles..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <section className="hp-faq-section">
                    <h3>Frequently Asked Questions</h3>
                    <div className="hp-faq-list">
                        {filteredFaqs.map((faq, index) => (
                            <div key={index} className={`hp-faq-card ${expandedIndex === index ? 'expanded' : ''}`}>
                                <button className="hp-faq-header" onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}>
                                    <span>{faq.question}</span>
                                    {expandedIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                <AnimatePresence>
                                    {expandedIndex === index && (
                                        <motion.div 
                                            className="hp-faq-answer"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                        >
                                            <p>{faq.answer}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="hp-contact-section">
                    <h3>Still Need Help?</h3>
                    <div className="hp-contact-grid">
                        <div className="hp-contact-card mail" onClick={() => window.location.href = 'mailto:support@bluestore.com'}>
                            <div className="hp-icon-circle"><Mail size={24} /></div>
                            <div className="hp-contact-info">
                                <h4>Email Support</h4>
                                <p>Get a response within 24 hours</p>
                            </div>
                            <ExternalLink size={16} className="hp-link-icon" />
                        </div>

                        <div className="hp-contact-card chat" onClick={() => alert('WhatsApp support connecting...')}>
                            <div className="hp-icon-circle"><MessageCircle size={24} /></div>
                            <div className="hp-contact-info">
                                <h4>WhatsApp Desk</h4>
                                <p>Instant help from our team</p>
                            </div>
                            <ExternalLink size={16} className="hp-link-icon" />
                        </div>
                    </div>
                </section>

                <footer className="hp-footer">
                    <p>Version 2.4.0 • Bluestore Global Support</p>
                </footer>
            </div>
        </div>
    );
};

export default HelpCenter;
