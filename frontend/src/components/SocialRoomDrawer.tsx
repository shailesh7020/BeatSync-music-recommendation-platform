import React, { useState, useEffect, useRef } from "react";
import { Users, X, Play, Pause, Send, Radio, MessageSquare, Disc3 } from "lucide-react";
import { Track } from "../types/music";

interface SocialRoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncPlay: (track: Track) => void;
  currentTrack: Track | null;
}

interface ChatMessage {
  username: string;
  text: string;
  time: number;
}

export const SocialRoomDrawer: React.FC<SocialRoomDrawerProps> = ({
  isOpen,
  onClose,
  onSyncPlay,
  currentTrack,
}) => {
  const [roomId, setRoomId] = useState("chill-lounge");
  const [username, setUsername] = useState("Audiophile");
  const [connected, setConnected] = useState(false);
  const [listenerCount, setListenerCount] = useState(1);
  const [sharedTrack, setSharedTrack] = useState<Track | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const wsRef = useRef<WebSocket | null>(null);

  const connectToRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsBase = `${protocol}//${window.location.host}`;
    if (import.meta.env.VITE_WS_BASE_URL) {
      wsBase = (import.meta.env.VITE_WS_BASE_URL as string).replace(/\/+$/, "");
    } else if (import.meta.env.VITE_API_BASE_URL) {
      wsBase = (import.meta.env.VITE_API_BASE_URL as string).replace(/^http/, "ws").replace(/\/+$/, "");
    }
    const wsUrl = `${wsBase}/ws/room/${encodeURIComponent(roomId)}?username=${encodeURIComponent(username)}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "SYNC_STATE" && data.state) {
          setListenerCount(data.state.listeners || 1);
          if (data.state.current_track) {
            setSharedTrack(data.state.current_track);
          }
        } else if (data.type === "USER_JOINED" || data.type === "USER_LEFT") {
          setListenerCount(data.listeners);
        } else if (data.type === "CHANGE_TRACK" && data.track) {
          setSharedTrack(data.track);
          onSyncPlay(data.track);
        } else if (data.type === "CHAT") {
          setMessages((prev) => [...prev.slice(-40), data]);
        }
      } catch (e) {
        // ignore
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };
  };

  useEffect(() => {
    if (isOpen && !connected) {
      connectToRoom();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen]);

  const sendBroadcastTrack = (track: Track) => {
    if (wsRef.current && connected) {
      wsRef.current.send(
        JSON.stringify({
          type: "CHANGE_TRACK",
          track,
        })
      );
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || !connected) return;
    wsRef.current.send(
      JSON.stringify({
        type: "CHAT",
        username,
        text: chatInput,
      })
    );
    setChatInput("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-spotify-surface border-l border-spotify-divider shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-spotify-divider flex items-center justify-between bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-spotify-green animate-pulse" />
          <div>
            <h3 className="font-extrabold text-sm text-white">Listen Together</h3>
            <p className="text-[10px] text-spotify-muted">
              {connected ? `${listenerCount} listening in '${roomId}'` : "Disconnected"}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-full text-spotify-muted hover:text-white hover:bg-zinc-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Room Controls */}
      <div className="p-3 bg-black/30 border-b border-spotify-divider text-xs space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room Name"
            className="flex-1 px-2.5 py-1 bg-spotify-card border border-white/10 rounded-lg text-white text-xs"
          />
          <button
            onClick={connectToRoom}
            className="px-3 py-1 bg-spotify-green text-black font-bold rounded-lg hover:bg-spotify-greenHover"
          >
            {connected ? "Rejoin" : "Join"}
          </button>
        </div>
      </div>

      {/* Shared Track Card */}
      <div className="p-4 border-b border-spotify-divider bg-zinc-900/20">
        <div className="flex items-center justify-between text-[11px] text-spotify-muted uppercase font-bold mb-2">
          <span>Synced Room Track</span>
          {connected && <span className="text-emerald-400">● Live Sync</span>}
        </div>

        {sharedTrack ? (
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-spotify-card border border-white/5">
            <div className="w-11 h-11 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0">
              {sharedTrack.image_url ? (
                <img src={sharedTrack.image_url} alt={sharedTrack.title} className="w-full h-full object-cover" />
              ) : (
                <Disc3 className="w-5 h-5 text-zinc-600 m-3" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-white truncate">{sharedTrack.title}</h4>
              <p className="text-[11px] text-spotify-muted truncate">{sharedTrack.artist}</p>
            </div>
            <button
              onClick={() => onSyncPlay(sharedTrack)}
              className="p-2 rounded-full bg-spotify-green text-black hover:scale-105 transition-transform"
              title="Sync Playback"
            >
              <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
            </button>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-spotify-muted">
            No track playing in room yet.
            {currentTrack && (
              <div className="mt-2">
                <button
                  onClick={() => sendBroadcastTrack(currentTrack)}
                  className="px-3 py-1 rounded-full bg-spotify-surface border border-spotify-green/40 text-spotify-green hover:bg-spotify-green hover:text-black transition-colors"
                >
                  Broadcast Current Song
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-spotify-muted flex flex-col items-center gap-1">
            <MessageSquare className="w-6 h-6 opacity-40" />
            <p>Room chat is quiet. Say hello!</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="p-2 rounded-lg bg-spotify-card/80 border border-white/5">
              <span className="font-bold text-spotify-green mr-1.5">{m.username}:</span>
              <span className="text-zinc-200">{m.text}</span>
            </div>
          ))
        )}
      </div>

      {/* Chat Input */}
      <form onSubmit={sendChat} className="p-3 border-t border-spotify-divider bg-zinc-900/60 flex gap-2">
        <input
          type="text"
          placeholder="Send a message to the room..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="flex-1 px-3 py-2 bg-spotify-card border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-spotify-green"
        />
        <button
          type="submit"
          disabled={!chatInput.trim() || !connected}
          className="p-2 bg-spotify-green text-black rounded-xl hover:bg-spotify-greenHover disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
