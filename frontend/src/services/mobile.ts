import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Network, ConnectionStatus } from "@capacitor/network";
import { Share } from "@capacitor/share";
import { App as CapApp } from "@capacitor/app";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";

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

// ---------------------------------------------------------------------------
// Native Offline Media Downloader (Saves tracks directly into mobile device storage)
// ---------------------------------------------------------------------------
export interface OfflineTrack {
  id: string | number;
  artist: string;
  title: string;
  image_url?: string | null;
  localPath: string;
  localUri: string;
  downloadedAt: number;
}

const OFFLINE_STORAGE_KEY = "beatsync_offline_tracks_v1";

export const getOfflineTracks = async (): Promise<OfflineTrack[]> => {
  try {
    const { value } = await Preferences.get({ key: OFFLINE_STORAGE_KEY });
    if (value) {
      return JSON.parse(value);
    }
  } catch (e) {
    console.warn("Failed to load offline tracks:", e);
  }
  return [];
};

export const isTrackDownloaded = async (trackId: string | number): Promise<boolean> => {
  const list = await getOfflineTracks();
  return list.some((t) => String(t.id) === String(trackId));
};

export const downloadTrackToDevice = async (
  track: { id?: string | number; artist: string; title: string; image_url?: string | null },
  downloadUrl: string
): Promise<{ success: boolean; message: string; localUri?: string }> => {
  if (!isNativePlatform()) {
    // Web fallback: trigger browser standard file download
    try {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${track.artist} - ${track.title}.m4a`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { success: true, message: "Download initiated in browser" };
    } catch (e: any) {
      return { success: false, message: e.message || "Download failed" };
    }
  }

  // Native Mobile (Android / iOS): Save file to local device storage using Filesystem
  try {
    const cleanArtist = track.artist.replace(/[\\/*?:"<>|]/g, "").trim();
    const cleanTitle = track.title.replace(/[\\/*?:"<>|]/g, "").trim();
    const relativePath = `BeatSync/${cleanArtist} - ${cleanTitle}.m4a`;

    // Download file directly to device Documents folder
    const res = await Filesystem.downloadFile({
      url: downloadUrl,
      path: relativePath,
      directory: Directory.Documents,
      recursive: true,
    });

    const localUri = Capacitor.convertFileSrc(res.path || relativePath);

    // Measure downloaded file size
    let sizeMb = "";
    let isFullSong = true;
    try {
      const fileStat = await Filesystem.stat({
        path: relativePath,
        directory: Directory.Documents,
      });
      if (fileStat.size) {
        const mb = (fileStat.size / (1024 * 1024)).toFixed(1);
        sizeMb = `${mb} MB`;
        isFullSong = fileStat.size >= 1_500_000;
      }
    } catch {
      // stat check optional
    }

    // Register track in offline preferences
    const existing = await getOfflineTracks();
    const filtered = existing.filter((t) => String(t.id) !== String(track.id || `${cleanArtist}-${cleanTitle}`));
    const newEntry: OfflineTrack = {
      id: track.id || `${cleanArtist}-${cleanTitle}`,
      artist: track.artist,
      title: track.title,
      image_url: track.image_url,
      localPath: res.path || relativePath,
      localUri,
      downloadedAt: Date.now(),
    };

    await Preferences.set({
      key: OFFLINE_STORAGE_KEY,
      value: JSON.stringify([newEntry, ...filtered]),
    });

    mobileHaptics.success();

    const successMessage = isFullSong
      ? `"${track.title}" (${sizeMb || "Full Song"}) saved to phone storage!`
      : `"${track.title}" (${sizeMb || "Preview"}) saved. Switch to Laptop Server in Settings for 100% full songs.`;

    return {
      success: true,
      message: successMessage,
      localUri,
    };
  } catch (err: any) {
    console.error("Native download failed:", err);
    return {
      success: false,
      message: err.message || "Failed to save song to mobile storage",
    };
  }
};

