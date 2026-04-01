import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // Reset scroll strictly for our main content container
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.scrollTo(0, 0);
        }
        // Fallback for full page layouts
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

export default ScrollToTop;
