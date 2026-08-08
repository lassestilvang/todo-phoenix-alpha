import { useEffect, useState } from 'react';

/**
 * Custom hook to detect if the user is on a mobile device
 * Returns a boolean indicating mobile status
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Function to check if device is mobile
    const checkIfMobile = () => {
      // Check user agent for mobile indicators
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;

      // Common mobile device detection
      const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

      // Also check viewport width as fallback
      const isSmallViewport = window.innerWidth <= 768;

      return isMobileDevice || isSmallViewport;
    };

    // Set initial state
    setIsMobile(checkIfMobile());

    // Listen for resize events
    const handleResize = () => {
      setIsMobile(checkIfMobile());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isMobile;
}

/**
 * Hook to get mobile-specific breakpoints
 */
export function useMobileBreakpoints() {
  const isMobile = useIsMobile();

  const breakpoints = {
    xs: isMobile && window.innerWidth < 480,
    sm: isMobile && window.innerWidth >= 480 && window.innerWidth < 640,
    md: isMobile && window.innerWidth >= 640 && window.innerWidth < 768,
    lg: isMobile && window.innerWidth >= 768,
    isMobile
  };

  return breakpoints;
}

/**
 * Hook to detect touch capability
 */
export function useTouchCapability(): boolean {
  const [isTouchCapable, setIsTouchCapable] = useState(false);

  useEffect(() => {
    const checkTouchCapability = () => {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0
      );
    };

    setIsTouchCapable(checkTouchCapability());
  }, []);

  return isTouchCapable;
}