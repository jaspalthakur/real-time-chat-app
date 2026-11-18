import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, LogOut, Send, Plus, Hash, Users, Circle,
  Menu, X, Smile, Search, Bell, Pin, Settings, AtSign,
  ChevronDown, Mic, Paperclip, Image, Gift, UserPlus,
} from 'lucide-react';
import api from '../api';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/* ───────────────── Helpers ───────────────── */

function adjustColor(hex, amt) {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function Avatar({ name, color, size = 'md', online, ring }) {
  const s = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size];
  const grad = `linear-gradient(135deg, ${color || '#6366f1'}, ${adjustColor(color || '#6366f1', -40)})`;
  return (
    <div className="relative shrink-0">
      <div className={`${s} rounded-full flex items-center justify-center font-bold text-white shadow-lg ${ring ? 'ring-2 ring-offset-2 ring-offset-gray-950 ring-indigo-500' : ''}`}
           style={{ background: grad }}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 block rounded-full border-[2.5px] border-gray-950
          ${online ? 'w-3.5 h-3.5 bg-emerald-500' : 'w-3 h-3 bg-gray-600'}
          ${online ? 'shadow-[0_0_6px_rgba(16,185,129,0.6)]' : ''}`} />
      )}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

const EMOJIS = [
  '😀','😂','😍','🥺','😎','🤔','😴','🤯',
  '❤️','🔥','✨','🎉','👍','👎','👋','🙌',
  '💯','🚀','💡','🎨','☕','🍕','🌙','⚡',
];

/* ════════════════════════════════════════════════════════
   MAIN CHAT COMPONENT
   ════════════════════════════════════════════════════════ */

export default function Chat({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ws = useRef(null);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  /* ── data fetching ── */
  const loadRooms = useCallback(async () => {
    try {
      const res = await api.get('/rooms/');
      setRooms(res.data);
      if (!activeRoom && res.data.length) setActiveRoom(res.data[0]);
    } catch {}
  }, [activeRoom]);

  useEffect(() => { loadRooms(); }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const [onRes, allRes] = await Promise.all([api.get('/users/online/'), api.get('/users/')]);
        setOnlineUsers(onRes.data);
        setAllUsers(allRes.data);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    api.get(`/rooms/${activeRoom.id}/messages/`).then(r => setMessages(r.data)).catch(() => {});
  }, [activeRoom]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── WebSocket ── */
  useEffect(() => {
    if (!activeRoom) return;
    const token = localStorage.getItem('access_token');
    const socket = new WebSocket(`${WS_URL}/ws/chat/${activeRoom.id}/?token=${token}`);
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'chat_message') {
        setMessages(prev => [...prev, {
          id: data.message_id, sender_name: data.username,
          sender_avatar_color: data.avatar_color, content: data.message, timestamp: data.timestamp,
        }]);
        setTypingUsers(prev => prev.filter(u => u !== data.username));
      } else if (data.type === 'typing') {
        if (data.username === user.username) return;
        setTypingUsers(prev => data.is_typing
          ? [...new Set([...prev, data.username])]
          : prev.filter(u => u !== data.username));
      } else if (data.type === 'user_status') {
        setOnlineUsers(prev => {
          if (data.is_online) return prev.find(u => u.username === data.username) ? prev : [...prev, { username: data.username }];
          return prev.filter(u => u.username !== data.username);
        });
      }
    };
    ws.current = socket;
    return () => socket.close();
  }, [activeRoom, user.username]);

  /* ── actions ── */
  const sendMessage = () => {
    const text = newMsg.trim();
    if (!text || !ws.current) return;
    ws.current.send(JSON.stringify({ type: 'chat_message', message: text, username: user.username }));
    setNewMsg('');
    setShowEmoji(false);
    ws.current.send(JSON.stringify({ type: 'typing', username: user.username, is_typing: false }));
    inputRef.current?.focus();
  };

  const handleTyping = (val) => {
    setNewMsg(val);
    if (!ws.current) return;
    ws.current.send(JSON.stringify({ type: 'typing', username: user.username, is_typing: true }));
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      ws.current?.send(JSON.stringify({ type: 'typing', username: user.username, is_typing: false }));
    }, 2000);
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const res = await api.post('/rooms/create/', { name: newRoomName.trim() });
      setRooms(prev => [...prev, res.data]);
      setActiveRoom(res.data);
      setNewRoomName('');
      setShowNewRoom(false);
    } catch {}
  };

  /* ── message grouping helpers ── */
  const shouldShowHeader = (msg, idx) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    if (prev.sender_name !== msg.sender_name) return true;
    return (new Date(msg.timestamp) - new Date(prev.timestamp)) > 300000;
  };

  const shouldShowDateSep = (msg, idx) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    return new Date(msg.timestamp).toDateString() !== new Date(prev.timestamp).toDateString();
  };

  const isOnline = (uname) => onlineUsers.some(u => u.username === uname);
  const filteredRooms = rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  /* ══════════════════ JSX ══════════════════ */
  return (
    <div className="h-screen flex bg-[#0a0a14] text-white overflow-hidden">

      {/* ════════ SERVER / CHANNEL SIDEBAR ════════ */}
      <aside className={`${mobileSidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        fixed md:static inset-y-0 left-0 z-30 w-[280px] flex flex-col
        bg-[#0f0f1a]/95 backdrop-blur-xl border-r border-white/[0.04]
        transition-transform duration-300 ease-out`}>

        {/* ── sidebar header ── */}
        <div className="h-[60px] px-4 flex items-center justify-between shrink-0 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <MessageSquare className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight">ChatterBox</h1>
              <p className="text-[10px] text-gray-600">Real-time messaging</p>
            </div>
          </div>
          <button onClick={() => setMobileSidebar(false)} className="md:hidden p-1 text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── search ── */}
        <div className="px-3 py-3">
          <div className="relative glow-focus rounded-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-gray-600 focus:outline-none transition"
              placeholder="Search channels…" />
          </div>
        </div>

        {/* ── channel list ── */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-2 pt-2 pb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.15em]">Channels</span>
            <button onClick={() => setShowNewRoom(!showNewRoom)}
              className="w-5 h-5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-500 hover:text-indigo-400 transition">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {showNewRoom && (
            <div className="mx-1 mb-3 p-3 rounded-2xl glass-light fade-in">
              <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createRoom()}
                placeholder="new-channel"
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 mb-2"
                autoFocus />
              <div className="flex gap-2">
                <button onClick={() => setShowNewRoom(false)}
                  className="flex-1 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/[0.04] transition">
                  Cancel
                </button>
                <button onClick={createRoom}
                  className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold transition">
                  Create
                </button>
              </div>
            </div>
          )}

          <div className="space-y-0.5">
            {filteredRooms.map(room => {
              const active = activeRoom?.id === room.id;
              return (
                <button key={room.id}
                  onClick={() => { setActiveRoom(room); setMessages([]); setMobileSidebar(false); setTypingUsers([]); }}
                  className={`group w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all duration-150
                    ${active
                      ? 'bg-gradient-to-r from-indigo-600/15 to-purple-600/10 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition
                    ${active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/[0.03] text-gray-600 group-hover:text-gray-500'}`}>
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] truncate ${active ? 'font-semibold' : 'font-medium'}`}>{room.name}</div>
                    {room.last_message && (
                      <div className="text-[11px] text-gray-700 truncate">
                        {room.last_message.sender}: {room.last_message.content}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── online users ── */}
        <div className="border-t border-white/[0.04]">
          <button className="w-full px-4 py-3 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-[0.15em] hover:text-gray-400 transition">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              Online — {onlineUsers.length}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <div className="px-2 pb-2 max-h-28 overflow-y-auto space-y-0.5">
            {onlineUsers.map(u => (
              <div key={u.username || u.id}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.03] transition">
                <Avatar name={u.username} color={u.avatar_color} size="xs" online={true} />
                <span className="text-[13px] text-gray-400 truncate">{u.username}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── user card ── */}
        <div className="p-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition">
            <Avatar name={user.username} color={user.avatar_color} size="sm" online={true} ring />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] truncate">{user.username}</div>
              <div className="text-[11px] text-emerald-500/80 font-medium">Online</div>
            </div>
            <button onClick={onLogout}
              className="p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* backdrop */}
      {mobileSidebar && <div onClick={() => setMobileSidebar(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 md:hidden" />}

      {/* ════════ MAIN CHAT AREA ════════ */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* ── chat header ── */}
        <header className="h-[60px] px-5 flex items-center gap-4 border-b border-white/[0.04] bg-[#0a0a14]/80 backdrop-blur-md shrink-0">
          <button onClick={() => setMobileSidebar(true)} className="md:hidden text-gray-500 hover:text-white p-1">
            <Menu className="w-5 h-5" />
          </button>
          {activeRoom ? (
            <>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
                  <Hash className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-[15px] truncate">{activeRoom.name}</h2>
                  {activeRoom.description && (
                    <p className="text-[11px] text-gray-600 truncate">{activeRoom.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition hidden sm:block">
                  <Pin className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition hidden sm:block">
                  <Bell className="w-4 h-4" />
                </button>
                <button onClick={() => setShowMembers(!showMembers)}
                  className={`p-2 rounded-xl transition ${showMembers ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'}`}>
                  <Users className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <h2 className="text-gray-600 font-medium">Select a channel</h2>
          )}
        </header>

        <div className="flex-1 flex min-h-0">
          {/* ── messages column ── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4">
              {!activeRoom && (
                <div className="flex flex-col items-center justify-center h-full text-gray-700 fade-in">
                  <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-600/5 to-purple-600/5 border border-white/[0.04] flex items-center justify-center mb-6">
                    <MessageSquare className="w-14 h-14 text-gray-800" />
                  </div>
                  <p className="text-xl font-bold text-gray-500 mb-2">Welcome to ChatterBox</p>
                  <p className="text-sm text-gray-700">Select a channel or create one to start chatting</p>
                </div>
              )}

              {activeRoom && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 fade-in">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/10 flex items-center justify-center mb-5">
                    <Hash className="w-10 h-10 text-indigo-500/50" />
                  </div>
                  <p className="text-lg font-bold text-gray-400 mb-1">Welcome to #{activeRoom.name}!</p>
                  <p className="text-sm text-gray-600 mb-4">This is the very beginning of the channel.</p>
                  <p className="text-2xl">👋</p>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isMe = msg.sender_name === user.username;
                const header = shouldShowHeader(msg, idx);
                const dateSep = shouldShowDateSep(msg, idx);

                return (
                  <div key={msg.id || `${msg.timestamp}-${idx}`}>
                    {/* date separator */}
                    {dateSep && (
                      <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-white/[0.04]" />
                        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                          {formatDateSeparator(msg.timestamp)}
                        </span>
                        <div className="flex-1 h-px bg-white/[0.04]" />
                      </div>
                    )}

                    <div className={`group flex gap-4 px-3 py-0.5 -mx-3 rounded-lg hover:bg-white/[0.015] transition msg-enter
                      ${header ? 'mt-5' : 'mt-0.5'}`}>
                      {/* avatar or gutter */}
                      <div className="w-10 shrink-0 pt-0.5">
                        {header ? (
                          <Avatar name={msg.sender_name} color={msg.sender_avatar_color} size="md" online={isOnline(msg.sender_name)} />
                        ) : (
                          <span className="text-[10px] text-gray-800 opacity-0 group-hover:opacity-100 transition tabular-nums leading-[20px] block text-right pr-0.5">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {/* content */}
                      <div className="flex-1 min-w-0">
                        {header && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className={`font-semibold text-[14px] hover:underline cursor-pointer
                              ${isMe ? 'text-indigo-400' : 'text-gray-200'}`}>
                              {msg.sender_name}
                            </span>
                            <span className="text-[11px] text-gray-700 font-medium">{formatTime(msg.timestamp)}</span>
                          </div>
                        )}
                        <p className="text-[15px] text-gray-300 leading-[1.625] break-words whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* typing */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-3 mt-2 fade-in">
                  <div className="flex -space-x-2">
                    {typingUsers.slice(0, 3).map(u => (
                      <div key={u} className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-300 ring-2 ring-[#0a0a14]">
                        {u[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex gap-[3px]">
                      <span className="typing-dot w-[5px] h-[5px] bg-gray-500 rounded-full" />
                      <span className="typing-dot w-[5px] h-[5px] bg-gray-500 rounded-full" />
                      <span className="typing-dot w-[5px] h-[5px] bg-gray-500 rounded-full" />
                    </span>
                    <span className="text-[12px] text-gray-600">
                      <strong className="text-gray-500">{typingUsers.join(', ')}</strong> {typingUsers.length === 1 ? 'is' : 'are'} typing…
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEnd} />
            </div>

            {/* ── input area ── */}
            {activeRoom && (
              <div className="px-4 lg:px-6 pb-6 pt-1 shrink-0">
                {/* emoji picker */}
                {showEmoji && (
                  <div className="mb-3 p-3 rounded-2xl glass border border-white/[0.06] shadow-2xl fade-in">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => { setNewMsg(prev => prev + e); inputRef.current?.focus(); }}
                          className="w-10 h-10 rounded-xl hover:bg-white/[0.06] flex items-center justify-center text-xl transition active:scale-90">
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative rounded-2xl bg-[#12121f] border border-white/[0.06] glow-focus transition-all shadow-lg shadow-black/20">
                  {/* toolbar row */}
                  <div className="flex items-center gap-0.5 px-3 pt-2">
                    <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.04] transition">
                      <Paperclip className="w-[18px] h-[18px]" />
                    </button>
                    <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.04] transition">
                      <Image className="w-[18px] h-[18px]" />
                    </button>
                    <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/[0.04] transition">
                      <Gift className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                  {/* input row */}
                  <div className="flex items-end gap-2 px-3 pb-2.5 pt-1">
                    <input ref={inputRef} value={newMsg}
                      onChange={e => handleTyping(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder={`Message #${activeRoom.name}`}
                      className="flex-1 py-2 bg-transparent text-[15px] text-white placeholder-gray-700 focus:outline-none" />
                    <div className="flex items-center gap-1 pb-0.5">
                      <button onClick={() => setShowEmoji(!showEmoji)}
                        className={`p-2 rounded-xl transition ${showEmoji ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-600 hover:text-gray-400'}`}>
                        <Smile className="w-5 h-5" />
                      </button>
                      <button onClick={sendMessage} disabled={!newMsg.trim()}
                        className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 disabled:opacity-20 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-95">
                        <Send className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ════════ MEMBERS PANEL ════════ */}
          {showMembers && activeRoom && (
            <div className="w-60 border-l border-white/[0.04] bg-[#0c0c18]/80 backdrop-blur-md hidden md:flex flex-col shrink-0 fade-in">
              <div className="p-4 border-b border-white/[0.04]">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Members</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {/* online */}
                <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest px-2 pt-2 pb-1">
                  Online — {onlineUsers.length}
                </p>
                {onlineUsers.map(u => (
                  <div key={u.username} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition">
                    <Avatar name={u.username} color={u.avatar_color} size="sm" online={true} />
                    <span className="text-[13px] text-gray-300 truncate">{u.username}</span>
                  </div>
                ))}
                {/* offline */}
                {allUsers.filter(u => !isOnline(u.username)).length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest px-2 pt-4 pb-1">
                      Offline — {allUsers.filter(u => !isOnline(u.username)).length}
                    </p>
                    {allUsers.filter(u => !isOnline(u.username)).map(u => (
                      <div key={u.username} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition opacity-50">
                        <Avatar name={u.username} color={u.avatar_color} size="sm" online={false} />
                        <span className="text-[13px] text-gray-500 truncate">{u.username}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
