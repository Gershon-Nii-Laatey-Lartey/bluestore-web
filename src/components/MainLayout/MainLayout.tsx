import React from 'react';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import MobileNavbar from '../MobileNavbar/MobileNavbar';
import { Outlet, useLocation } from 'react-router-dom';
import '../../App.css';

const MainLayout: React.FC = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const location = useLocation();

    // Check if we are in chat detail (more than just '/chat')
    const isChatDetail = location.pathname.startsWith('/chat/') && location.pathname !== '/chat';

    return (
        <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Header onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} isSidebarCollapsed={isSidebarCollapsed} />
            <div className="app-body">
                <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
            {!isChatDetail && <MobileNavbar />}
        </div>
    );
};

export default MainLayout;
