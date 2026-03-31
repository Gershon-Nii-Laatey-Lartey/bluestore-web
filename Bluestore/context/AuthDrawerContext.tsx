import React, { createContext, useContext, useState } from 'react';
import { AuthDrawer } from '@/components/AuthDrawer';

interface AuthDrawerContextType {
    showAuthDrawer: () => void;
    hideAuthDrawer: () => void;
}

const AuthDrawerContext = createContext<AuthDrawerContextType | undefined>(undefined);

export function AuthDrawerProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);

    const showAuthDrawer = () => setVisible(true);
    const hideAuthDrawer = () => setVisible(false);

    return (
        <AuthDrawerContext.Provider value={{ showAuthDrawer, hideAuthDrawer }}>
            {children}
            <AuthDrawer visible={visible} onClose={hideAuthDrawer} />
        </AuthDrawerContext.Provider>
    );
}

export function useAuthDrawer() {
    const context = useContext(AuthDrawerContext);
    if (context === undefined) {
        throw new Error('useAuthDrawer must be used within an AuthDrawerProvider');
    }
    return context;
}
