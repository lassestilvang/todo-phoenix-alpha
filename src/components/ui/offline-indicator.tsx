"use client";

import { useState, useEffect } from 'react';
import { WifiOff, Cloud, CloudUpload } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Set initial state
    updateOnlineStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Show offline message briefly
    if (!navigator.onLine) {
      setShowOfflineMessage(true);
      const timer = setTimeout(() => setShowOfflineMessage(false), 4000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
      };
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Show online transition briefly
  useEffect(() => {
    if (isOnline && showOfflineMessage) {
      const timer = setTimeout(() => setShowOfflineMessage(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showOfflineMessage]);

  if (isOnline && !showOfflineMessage) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
        showOfflineMessage
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0'
      }`}
    >
      <div
        className={`px-4 py-3 flex items-center justify-center gap-3 text-sm font-medium ${
          isOnline
            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        }`}
      >
        {isOnline ? (
          <>
            <CloudUpload className="w-5 h-5" />
            <span>Connection restored — all changes synced</span>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <span>You're offline — working in local mode</span>
            <Cloud className="w-5 h-5 opacity-50" />
          </>
        )}
      </div>
    </div>
  );
}

// Hook for tracking online/offline state
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Get connection type (if available)
    const connection = (navigator as any).connection;
    if (connection) {
      setConnectionType(connection.effectiveType || 'unknown');
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('resize', () => setIsOnline(navigator.onLine));

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return { isOnline, connectionType };
}