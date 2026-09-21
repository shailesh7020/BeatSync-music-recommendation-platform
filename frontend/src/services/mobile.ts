import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Network, ConnectionStatus } from "@capacitor/network";
import { Share } from "@capacitor/share";
import { App as CapApp } from "@capacitor/app";

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = (): "android" | "ios" | "web" => {
  return Capacitor.getPlatform() as "android" | "ios" | "web";
};

export const initMobileApp = async () => {
  if (!isNativePlatform()) return;

  try {
    // 1. Configure Dark Immersive Status Bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#121212" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {
    console.debug("Status bar configuration:", e);
  }

  try {
    // 2. Hide Splash Screen after React is fully mounted
    setTimeout(async () => {
      await SplashScreen.hide({ fadeOutDuration: 400 });
    }, 500);
  } catch (e) {
    console.debug("Splash screen hide:", e);
  }
};

// Haptic feedback triggers
export const mobileHaptics = {
  light: async () => {
    if (!isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // ignore
    }
  },
  medium: async () => {
    if (!isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // ignore
    }
  },
  success: async () => {
    if (!isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // ignore
    }
  },
};

// Native Sharing with web fallback
export const shareMedia = async (title: string, text: string, url: string): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: `Share ${title}`,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Web fallback
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(`${title} - ${url}`);
    return true;
  } catch {
    return false;
  }
};

// Network status monitoring
export const subscribeNetworkStatus = (onChange: (connected: boolean) => void) => {
  let handler: any = null;

  Network.getStatus().then((status) => {
    onChange(status.connected);
  });

  const listener = Network.addListener("networkStatusChange", (status: ConnectionStatus) => {
    onChange(status.connected);
  });

  return () => {
    listener.then((h) => h.remove());
  };
};

// Android Hardware Back Button Handling
export const registerHardwareBackButton = (onBack: () => boolean) => {
  if (!isNativePlatform() || getPlatform() !== "android") return () => {};

  const listener = CapApp.addListener("backButton", () => {
    // If custom handler handled the action (e.g. closed a modal), do not exit app
    const handled = onBack();
    if (!handled) {
      // Default: minimize app gracefully rather than closing process
      CapApp.minimizeApp();
    }
  });

  return () => {
    listener.then((h) => h.remove());
  };
};
