import React, { useState, useEffect } from "react";
import { X, Server, Wifi, Cloud, Check, Loader2, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { api, ServerMode, DEFAULT_CLOUD_API, DEFAULT_LAPTOP_API, BackendInfo } from "../services/api";

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerChanged?: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  onServerChanged,
}) => {
  const [currentInfo, setCurrentInfo] = useState<BackendInfo>({
    origin: api.getActiveOrigin(),
    mode: api.getActiveMode(),
    isHealthy: null,
    latencyMs: null,
    isLocal: api.getActiveOrigin().includes("192.168") || api.getActiveOrigin().includes("localhost"),
  });

  const [selectedMode, setSelectedMode] = useState<ServerMode>(api.getActiveMode());
  const [customUrl, setCustomUrl] = useState<string>(DEFAULT_LAPTOP_API);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; message?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentInfo({
        origin: api.getActiveOrigin(),
        mode: api.getActiveMode(),
        isHealthy: null,
        latencyMs: null,
        isLocal: api.getActiveOrigin().includes("192.168") || api.getActiveOrigin().includes("localhost"),
      });
      setSelectedMode(api.getActiveMode());
      // Test current backend health
      api.pingOrigin(api.getActiveOrigin()).then((res) => {
        setCurrentInfo((prev) => ({
          ...prev,
          isHealthy: res.ok,
          latencyMs: res.latencyMs,
        }));
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    let targetOrigin = DEFAULT_CLOUD_API;
    if (selectedMode === "laptop") targetOrigin = DEFAULT_LAPTOP_API;
    else if (selectedMode === "custom") targetOrigin = customUrl.trim();
    else if (selectedMode === "auto") targetOrigin = DEFAULT_LAPTOP_API;

    const res = await api.pingOrigin(targetOrigin);
    setIsTesting(false);
    if (res.ok) {
      setTestResult({
        ok: true,
        latencyMs: res.latencyMs,
        message: `Connected successfully! (${res.latencyMs}ms)`,
      });
    } else {
      setTestResult({
        ok: false,
        message: `Could not connect to ${targetOrigin}. Ensure backend is running and phone is on same Wi-Fi.`,
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updated = await api.switchBackend(selectedMode, customUrl.trim());
    setIsSaving(false);
    setCurrentInfo(updated);
    if (onServerChanged) {
      onServerChanged();
    }
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-spotify-green/10 text-spotify-green">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Backend Server Settings</h2>
              <p className="text-xs text-zinc-400">Choose server for audio streaming & full song downloads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Status Banner */}
        <div className="mt-4 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Currently Connected:</span>
            <span className="font-mono text-emerald-400 flex items-center gap-1.5 font-bold truncate max-w-[200px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              {currentInfo.origin || "Local"}
            </span>
          </div>
          {currentInfo.latencyMs !== null && (
            <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-500">
              <span>Roundtrip Latency:</span>
              <span>{currentInfo.latencyMs} ms</span>
            </div>
          )}
        </div>

        {/* Server Selection Options */}
        <div className="mt-4 space-y-2.5">
          {/* Option 1: Auto Detect */}
          <label
            onClick={() => setSelectedMode("auto")}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selectedMode === "auto"
                ? "bg-spotify-green/10 border-spotify-green/60 shadow-md"
                : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-900"
            }`}
          >
            <input
              type="radio"
              name="serverMode"
              checked={selectedMode === "auto"}
              onChange={() => setSelectedMode("auto")}
              className="mt-1 accent-spotify-green"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm">
                <Sparkles className="w-3.5 h-3.5 text-spotify-green" />
                <span>Auto-Detect (Recommended)</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Automatically connects to Laptop Wi-Fi if available for 100% full song downloads; falls back to cloud Render if outside.
              </p>
            </div>
          </label>

          {/* Option 2: Laptop Wi-Fi Server */}
          <label
            onClick={() => setSelectedMode("laptop")}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selectedMode === "laptop"
                ? "bg-emerald-500/10 border-emerald-500/60 shadow-md"
                : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-900"
            }`}
          >
            <input
              type="radio"
              name="serverMode"
              checked={selectedMode === "laptop"}
              onChange={() => setSelectedMode("laptop")}
              className="mt-1 accent-emerald-400"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-white">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Laptop Server (Wi-Fi)</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Full 4-12 MB Songs
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                {DEFAULT_LAPTOP_API}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                1-second downloads of full high-definition songs directly to phone storage. Phone must be on same Wi-Fi.
              </p>
            </div>
          </label>

          {/* Option 3: Cloud Render Server */}
          <label
            onClick={() => setSelectedMode("cloud")}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selectedMode === "cloud"
                ? "bg-cyan-500/10 border-cyan-500/60 shadow-md"
                : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-900"
            }`}
          >
            <input
              type="radio"
              name="serverMode"
              checked={selectedMode === "cloud"}
              onChange={() => setSelectedMode("cloud")}
              className="mt-1 accent-cyan-400"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-white">
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cloud Server (Render)</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Works worldwide on mobile data (4G/5G) or outside Wi-Fi.
              </p>
            </div>
          </label>

          {/* Option 4: Custom URL */}
          <label
            onClick={() => setSelectedMode("custom")}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              selectedMode === "custom"
                ? "bg-purple-500/10 border-purple-500/60 shadow-md"
                : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-900"
            }`}
          >
            <input
              type="radio"
              name="serverMode"
              checked={selectedMode === "custom"}
              onChange={() => setSelectedMode("custom")}
              className="mt-1 accent-purple-400"
            />
            <div className="flex-1">
              <span className="font-semibold text-xs sm:text-sm text-white">Custom IP / Host</span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Specify custom IP if your router assigns a new address to your laptop.
              </p>
              {selectedMode === "custom" && (
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="http://192.168.1.189:8000"
                  className="mt-2 w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                />
              )}
            </div>
          </label>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              testResult.ok
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                : "bg-red-500/15 border border-red-500/30 text-red-300"
            }`}
          >
            {testResult.ok ? (
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Test Ping</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-spotify-green hover:bg-spotify-green-hover text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-spotify-green/20 transition-all"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Apply & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
