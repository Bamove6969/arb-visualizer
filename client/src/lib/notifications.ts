// Notification and alert system for arbitrage opportunities

// Check if running in Capacitor (native app)
const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (isCapacitor) {
    // Use Capacitor Local Notifications
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const permission = await LocalNotifications.checkPermissions();
      
      if (permission.display === 'granted') {
        return true;
      }
      
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('Capacitor notifications error:', error);
      return false;
    }
  }
  
  // Web notifications
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

// Check if notifications are enabled
export function isNotificationEnabled(): boolean {
  if (isCapacitor) {
    return true; // Will check permissions when sending
  }
  return "Notification" in window && Notification.permission === "granted";
}

// Send urgent push notification with persistence
export async function sendUrgentNotification(title: string, body: string, data?: any): Promise<void> {
  if (isCapacitor) {
    // Use Capacitor Local Notifications for persistent notifications
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body,
            schedule: { at: new Date(Date.now() + 100) }, // Show immediately
            sound: 'default',
            attachments: undefined,
            actionTypeId: 'ARBITRAGE_ALERT',
            extra: data,
            ongoing: false, // Not persistent (user can dismiss)
            autoCancel: true,
            smallIcon: 'ic_stat_icon_config_sample',
            largeIcon: 'ic_stat_icon_config_sample',
          }
        ]
      });
    } catch (error) {
      console.error('Failed to send Capacitor notification:', error);
    }
    return;
  }
  
  // Web notification (fallback)
  if (!isNotificationEnabled()) return;

  const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.svg",
    tag: "arbitrage-alert",
    requireInteraction: true, // Keep notification visible until user interacts
    silent: false,
    data,
  };

  // Vibration is supported in some browsers
  if ("vibrate" in navigator) {
    (notificationOptions as any).vibrate = [500, 200, 500, 200, 500];
  }

  const notification = new Notification(title, notificationOptions);

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

// Audio alert system
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Alert sound patterns for different ROI levels
type AlertLevel = "urgent" | "normal" | "gentle";

function getAlertPattern(level: AlertLevel): { frequencies: number[]; durations: number[]; delays: number[] } {
  switch (level) {
    case "urgent": // ROI >= 5%
      // Fast, high-pitched, insistent pattern
      return {
        frequencies: [1200, 880, 1200, 880, 1400],
        durations: [0.12, 0.12, 0.12, 0.12, 0.35],
        delays: [0, 0.15, 0.3, 0.45, 0.6]
      };
    case "normal": // ROI 3-5%
      // Medium pace, standard alert
      return {
        frequencies: [880, 660, 880, 660, 1100],
        durations: [0.15, 0.15, 0.15, 0.15, 0.3],
        delays: [0, 0.2, 0.4, 0.6, 0.8]
      };
    case "gentle": // ROI 1-3%
      // Slower, softer, single beep
      return {
        frequencies: [660, 880],
        durations: [0.2, 0.25],
        delays: [0, 0.3]
      };
  }
}

// Play alert sound with volume control and ROI-based patterns
export function playAlertSound(volume: number = 0.7, roi?: number): void {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (required for autoplay policies)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Determine alert level based on ROI
    let level: AlertLevel = "normal";
    if (roi !== undefined) {
      if (roi >= 5) level = "urgent";
      else if (roi >= 3) level = "normal";
      else level = "gentle";
    }

    const pattern = getAlertPattern(level);

    // Create oscillator for alert beep sequence
    const playBeep = (startTime: number, frequency: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = "square";
      
      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    
    // Play the pattern
    for (let i = 0; i < pattern.frequencies.length; i++) {
      playBeep(
        now + pattern.delays[i],
        pattern.frequencies[i],
        pattern.durations[i]
      );
    }
    
  } catch (err) {
    console.error("Failed to play alert sound:", err);
  }
}

// Vibrate device (mobile)
export function vibrateDevice(): void {
  if ("vibrate" in navigator) {
    // Strong vibration pattern: long-short-long-short-long
    navigator.vibrate([500, 200, 500, 200, 800]);
  }
}

// Flash screen for visual alert
export function flashScreen(flashCount: number = 3): void {
  const overlay = document.createElement("div");
  overlay.id = "alert-flash-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 165, 0, 0.4);
    z-index: 99999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s ease;
  `;
  document.body.appendChild(overlay);

  let count = 0;
  const flash = () => {
    if (count >= flashCount * 2) {
      overlay.remove();
      return;
    }
    overlay.style.opacity = count % 2 === 0 ? "1" : "0";
    count++;
    setTimeout(flash, 150);
  };
  flash();
}

// Combined urgent alert - fires all notification methods
export function triggerUrgentAlert(
  title: string, 
  message: string,
  options?: {
    playSound?: boolean;
    vibrate?: boolean;
    flash?: boolean;
    notification?: boolean;
    soundVolume?: number; // 0-1 range
    roi?: number; // For ROI-based sound pattern
  }
): void {
  const opts = {
    playSound: true,
    vibrate: true,
    flash: true,
    notification: true,
    soundVolume: 0.7,
    ...options
  };

  // Play sound
  if (opts.playSound) {
    playAlertSound(opts.soundVolume, opts.roi);
  }

  // Vibrate
  if (opts.vibrate) {
    vibrateDevice();
  }

  // Flash screen
  if (opts.flash) {
    flashScreen();
  }

  // Send push notification
  if (opts.notification) {
    sendUrgentNotification(title, message);
  }
}
