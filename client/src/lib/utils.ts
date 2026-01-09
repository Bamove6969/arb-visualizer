import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Opens two URLs in a split-screen arrangement
 * - Desktop: Opens two windows side-by-side
 * - Fold phones (wide screens): Opens in multi-window mode
 * - Regular mobile: Opens in sequential tabs
 */
export function openInSplitScreen(urlA: string, urlB: string, options?: {
  titleA?: string;
  titleB?: string;
}) {
  const screenWidth = window.screen.availWidth;
  const screenHeight = window.screen.availHeight;
  const isWideScreen = screenWidth >= 1024; // Desktop or unfolded tablet/fold
  const isFoldPhone = screenWidth >= 800 && screenWidth < 1024 && 'ontouchstart' in window;
  
  if (isWideScreen || isFoldPhone) {
    // Calculate dimensions for side-by-side windows
    const windowWidth = Math.floor(screenWidth / 2) - 20; // 20px gap
    const windowHeight = screenHeight - 100; // Leave room for taskbar/nav
    
    // Open left window (Market A)
    const leftWindow = window.open(
      urlA,
      '_blank',
      `width=${windowWidth},height=${windowHeight},left=0,top=50,scrollbars=yes,resizable=yes`
    );
    
    // Open right window (Market B) with slight delay
    setTimeout(() => {
      const rightWindow = window.open(
        urlB,
        '_blank',
        `width=${windowWidth},height=${windowHeight},left=${windowWidth + 20},top=50,scrollbars=yes,resizable=yes`
      );
      
      // Focus the left window for better UX
      if (leftWindow) {
        leftWindow.focus();
      }
    }, 300);
    
  } else {
    // Mobile: Open in tabs with delay
    window.open(urlA, '_blank');
    setTimeout(() => window.open(urlB, '_blank'), 300);
  }
}

/**
 * Check if device supports split-screen viewing
 */
export function supportsSplitScreen(): boolean {
  const screenWidth = window.screen.availWidth;
  return screenWidth >= 800; // Tablets and desktops
}
