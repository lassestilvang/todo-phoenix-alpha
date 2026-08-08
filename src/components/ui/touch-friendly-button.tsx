"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TouchFriendlyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  touchTarget?: boolean;
}

export const TouchFriendlyButton = forwardRef<HTMLButtonElement, TouchFriendlyButtonProps>(
  (
    {
      className,
      children,
      size = 'md',
      variant = 'default',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      touchTarget = true,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-medium transition-all duration-150
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:pointer-events-none
      active:scale-[0.98]
      ${touchTarget ? 'min-h-[44px] min-w-[44px]' : ''}
    `;

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
      xl: 'px-8 py-4 text-lg gap-3',
    };

    const variantStyles = {
      default: `
        bg-blue-600 text-white hover:bg-blue-700
        focus:ring-blue-500 dark:focus:ring-blue-400
        shadow-sm hover:shadow-md
      `,
      outline: `
        border-2 border-gray-300 dark:border-gray-600
        bg-transparent text-gray-700 dark:text-gray-300
        hover:bg-gray-50 dark:hover:bg-gray-800
        focus:ring-gray-500
      `,
      ghost: `
        bg-transparent text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:ring-gray-500
      `,
      destructive: `
        bg-red-600 text-white hover:bg-red-700
        focus:ring-red-500 dark:focus:ring-red-400
        shadow-sm hover:shadow-md
      `,
      secondary: `
        bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100
        hover:bg-gray-200 dark:hover:bg-gray-700
        focus:ring-gray-500
      `,
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], fullWidth && 'w-full', className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

TouchFriendlyButton.displayName = 'TouchFriendlyButton';

// Mobile-optimized FAB (Floating Action Button)
interface FABProps {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'sm' | 'md' | 'lg';
  isOpen?: boolean;
  onClose?: () => void;
}

export function FloatingActionButton({
  onClick,
  children,
  className,
  position = 'bottom-right',
  size = 'md',
  isOpen,
  onClose,
}: FABProps) {
  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'top-right': 'fixed top-6 right-6',
    'top-left': 'fixed top-6 left-6',
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        positionClasses[position],
        sizeClasses[size],
        'rounded-full bg-blue-600 text-white shadow-xl',
        'flex items-center justify-center',
        'hover:bg-blue-700 active:scale-95',
        'transition-all duration-200',
        'focus:outline-none focus:ring-4 focus:ring-blue-500/50',
        'z-50',
        isOpen && 'rotate-45 bg-red-500',
        className
      )}
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
    >
      {children}
    </button>
  );
}

// Touch-friendly swipeable card
interface SwipeableCardProps {
  children: ReactNode;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  threshold?: number;
  className?: string;
}

export function SwipeableCard({
  children,
  leftActions,
  rightActions,
  threshold = 80,
  className,
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    const clampedDelta = Math.max(-200, Math.min(200, deltaX));
    setTranslateX(clampedDelta);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(translateX) > threshold) {
      // Trigger action
      if (translateX > 0 && leftActions) {
        // Left swipe - show left actions
      } else if (translateX < 0 && rightActions) {
        // Right swipe - show right actions
      }
    }
    setTranslateX(0);
  };

  return (
    <div
      className={cn('relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateX(${translateX}px)` }}
    >
      {rightActions && translateX < 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4 opacity-0 transition-opacity pointer-events-none">
          {rightActions}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Touch feedback utility
export function useTouchFeedback() {
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.currentTarget;
    target.style.transform = 'scale(0.98)';
    target.style.transition = 'transform 0.1s ease-out';
    setActiveElement(target);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const target = e.currentTarget;
    target.style.transform = '';
    setActiveElement(null);
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    const target = e.currentTarget;
    target.style.transform = '';
    setActiveElement(null);
  };

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}