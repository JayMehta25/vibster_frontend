import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DomeGallery from './DomeGallery';
import DotGrid from './DotGrid';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import DashboardChat from './DashboardChat';
import socket from './socket';
import Swal from 'sweetalert2';

// Sample users so the dome always looks populated
const SAMPLE_PEOPLE = [
  { username: 'Arjun', isOnline: true },
  { username: 'Zara', isOnline: false },
  { username: 'Kai', isOnline: true },
  { username: 'Mira', isOnline: true },
  { username: 'Leo', isOnline: false },
  { username: 'Nia', isOnline: true },
  { username: 'Ryo', isOnline: false },
  { username: 'Ava', isOnline: true },
];

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dbFriends, setDbFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showChatsPanel, setShowChatsPanel] = useState(false);
  const [chatPreviews, setChatPreviews] = useState([]);
  const [activeDmFriend, setActiveDmFriend] = useState(null);

  // Standardized username derivation
  const myUsername = useMemo(() => {
    if (!user) return localStorage.getItem('username');
    return user.user_metadata?.username || localStorage.getItem('username') || user.email?.split('@')[0];
  }, [user]);

  // Keep localStorage in sync for consistency across components
  useEffect(() => {
    if (myUsername) localStorage.setItem('username', myUsername);
  }, [myUsername]);

  // Refs for socket listeners to avoid stale data/loops
  const dbFriendsRef = useRef([]);
  const requestsRef = useRef([]);
  const activeDmFriendRef = useRef(null);

  useEffect(() => { dbFriendsRef.current = dbFriends; }, [dbFriends]);
  useEffect(() => { requestsRef.current = requests; }, [requests]);
  useEffect(() => { activeDmFriendRef.current = activeDmFriend; }, [activeDmFriend]);

  // Fetch real friends from Supabase once on mount/user change
  useEffect(() => {
    if (!user) return;
    supabase
      .from('friendships')
      .select('friend_username, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.warn('Friendships fetch error:', error); return; }
        if (data && data.length > 0) {
          setDbFriends(data.map((f) => ({
            username: f.friend_username,
            isOnline: false,
          })));
        } else {
          try {
            const key = `vibester:favorites:${user.id}`;
            const raw = localStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                setDbFriends(list.map((f) => ({
                  username: f.username || 'Unknown',
                  isOnline: false,
                })));
              }
            }
          } catch { /* ignore */ }
        }
      });
  }, [user]);

  // Fetch incoming friend requests AFTER dbFriends is loaded to avoid race condition
  // This runs after dbFriends state is updated so the ref is accurate
  useEffect(() => {
    if (!user || !myUsername) return;
    supabase
      .from('friendships')
      .select('user_id, created_at')
      .eq('friend_username', myUsername)
      .then(async ({ data, error }) => {
        if (error) return;
        if (data && data.length > 0) {
          const reqs = [];
          for (const r of data) {
            const { data: profile } = await supabase
              .from('profiles').select('username').eq('id', r.user_id).single();
            // Only add as a request if NOT already a mutual friend
            if (profile && !dbFriends.some(f => f.username === profile.username)) {
              reqs.push({ username: profile.username, id: r.user_id });
            }
          }
          setRequests(reqs);
        }
      });
  }, [user, myUsername, dbFriends]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Socket Events & Status Polling
  useEffect(() => {
    if (!user) return;

    // Listen for real-time friend requests
    const registerWithSocket = () => {
      if (myUsername) {
        console.log('[Dashboard] Registering socket as:', myUsername);
        socket.emit('register', myUsername.toLowerCase());
      }
    };

    // Register immediately; if not connected, connect first
    if (socket.connected) {
      registerWithSocket();
    } else {
      socket.connect();
    }
    socket.on('connect', registerWithSocket);

    const handleOnlineUsers = (list) => {
      // Use lowercase comparison to avoid case-sensitivity mismatches
      const lowerList = list.map(u => u.toLowerCase());
      setDbFriends(prev => prev.map(f => ({
        ...f,
        isOnline: lowerList.includes(f.username.toLowerCase())
      })));
    };

    socket.on('onlineUsersList', handleOnlineUsers);

    // Poll for status updates every 30s
    const statusInterval = setInterval(() => {
      socket.emit('getOnlineUsers');
    }, 30000);
    socket.emit('getOnlineUsers');

    const handleIncomingRequest = ({ from }) => {
      // Only add if not already a friend or already in requests
      if (!dbFriendsRef.current.some(f => f.username === from) && !requestsRef.current.some(r => r.username === from)) {
        setRequests(prev => [...prev, { username: from }]);
        Swal.fire({
          title: 'New Friend Request',
          text: `${from} added you! Check your connections.`,
          toast: true,
          position: 'top-end',
          timer: 4000,
          showConfirmButton: false,
          background: 'rgba(50, 10, 80, 0.95)',
          color: '#fff'
        });
      }
    };

    socket.on('incomingFriendRequest', handleIncomingRequest);

    const handleIncomingMessage = (msg) => {
      setChatPreviews((prev) => {
        const existing = prev.find(p => p.username === msg.from);
        const newEntry = {
          username: msg.from,
          lastMessage: msg.content,
          time: 'just now',
          unread: (activeDmFriendRef.current?.username === msg.from) ? 0 : (existing ? (existing.unread || 0) + 1 : 1),
          isOnline: true
        };
        const filtered = prev.filter(p => p.username !== msg.from);
        return [newEntry, ...filtered];
      });
      // Also show a toast if not looking at this chat
      if (activeDmFriendRef.current?.username !== msg.from) {
        Swal.fire({
          title: 'New Message',
          text: `${msg.from}: ${msg.content.slice(0, 30)}${msg.content.length > 30 ? '...' : ''}`,
          toast: true,
          position: 'bottom-end',
          timer: 3000,
          showConfirmButton: false,
          background: 'rgba(8,12,30,0.95)',
          color: '#fff'
        });
      }
    };
    socket.on('incomingDashboardMessage', handleIncomingMessage);

    return () => {
      socket.off('connect', registerWithSocket);
      socket.off('incomingFriendRequest', handleIncomingRequest);
      socket.off('incomingDashboardMessage', handleIncomingMessage);
      socket.off('onlineUsersList', handleOnlineUsers);
      clearInterval(statusInterval);
    };
  }, [user, myUsername]);


  // Only show real friends in the dome — no sample users
  const people = useMemo(() => [...dbFriends], [dbFriends]);

  const handleQuickMatch = () => {
    const username = user?.user_metadata?.username || localStorage.getItem('username') || 'Guest';
    navigate('/interest-chat', {
      state: {
        username,
        interests: ['random'],
        isRandom: true,
      },
    });
  };


  const LAST_MESSAGES_FALLBACK = [
    'Hey! How are you doing?',
    'That was a fun conversation!',
    'We should chat again sometime',
    'Thanks for the match!',
    'Are you still online?',
    "Let's connect again!",
    'Great talking to you',
    'Catch you later!',
  ];
  const TIMES_FALLBACK = ['just now', '2m ago', '15m ago', '1h ago', '3h ago', 'yesterday', '2d ago', '3d ago'];

  const formatTimeAgo = (isoStr) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'yesterday' : days + 'd ago';
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('messages')
      .select('sender_username, receiver_username, content, sent_at')
      .or(`sender_id.eq.${user.id},receiver_username.eq.${myUsername}`)
      .order('sent_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) {
          console.debug('[Chats] messages fetch skipped:', error.code);
          setChatPreviews([]);
          return;
        }
        // Build one preview per unique participant
        const seen = new Map();
        (data || []).forEach((m) => {
          const otherPerson = m.sender_username === myUsername ? m.receiver_username : m.sender_username;
          if (otherPerson && !seen.has(otherPerson)) {
            seen.set(otherPerson, m);
          }
        });
        // Convert map to array, find matching person object for online status etc.
        const previews = Array.from(seen.values()).map((m) => {
          const otherPerson = m.sender_username === myUsername ? m.receiver_username : m.sender_username;
          const personObj = people.find((p) => p.username === otherPerson) || { username: otherPerson, isOnline: false };
          return {
            ...personObj,
            lastMessage: m.content,
            time: formatTimeAgo(m.sent_at),
            unread: 0,
          };
        });
        setChatPreviews(previews);
      });
  }, [user, people]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalUnread = useMemo(() => chatPreviews.reduce((s, c) => s + c.unread, 0), [chatPreviews]);

  const handleTextFriend = async (friend) => {
    // friend can be a string (username) or a full person object
    let personObj = typeof friend === 'string'
      ? people.find((p) => p.username === friend) || { username: friend, isOnline: false }
      : friend;

    // If it's a request (has isRequest: true or we can check requests state)
    const isIncomingRequest = requests.some(r => r.username === personObj.username);
    if (isIncomingRequest) {
      // Mutualize the friendship in Supabase
      try {
        await supabase.from('friendships').upsert({
          user_id: user.id,
          friend_username: personObj.username,
          added_from: 'dashboard-request'
        }, { onConflict: 'user_id,friend_username' });

        // Remove from requests state and add to dbFriends
        setRequests(prev => prev.filter(r => r.username !== personObj.username));
        if (!dbFriends.some(f => f.username === personObj.username)) {
          setDbFriends(prev => [...prev, { username: personObj.username, isOnline: true }]);
        }

        await Swal.fire({
          title: 'Connected!',
          text: `You and ${personObj.username} can now chat freely.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: 'rgba(8,12,30,0.95)',
          color: '#fff'
        });
      } catch (err) {
        console.warn('Add back failed:', err);
      }
    }

    setSelectedPerson(null);
    setActiveDmFriend({ ...personObj, isRequest: isIncomingRequest });
    setShowChatsPanel(false);
    setShowFriendsPanel(false);
  };

  const BIOS = [
    'Music lover 🎵 | Coffee addict ☕',
    'Exploring the world one city at a time 🌍',
    'Code by day, game by night 🎮',
    'Life is short, smile while you still have teeth 😁',
    'Just here to vibe ✨',
    'Bookworm 📚 | Cat person 🐱',
    'Fitness freak 💪 | Healthy eater 🥗',
    'Night owl 🦉 | Stargazer ⭐',
  ];

  const getPersonBio = (username) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) & 0xffff;
    return BIOS[hash % BIOS.length];
  };

  const handleAddToRoom = () => { navigate('/chatlanding'); };

  const handleRemoveFriend = async (username) => {
    const result = await Swal.fire({
      title: `Remove ${username}?`,
      text: 'They will be removed from your connections and all chat history will be deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e17055',
      background: 'rgba(8,12,30,0.97)',
      color: '#fff'
    });
    if (!result.isConfirmed) return;

    // Delete the forward friendship (me → them)
    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_username', username);

    // Delete reverse entry (them → me) without needing a profile lookup
    await supabase
      .from('friendships')
      .delete()
      .eq('friend_username', myUsername)
      .neq('user_id', user.id); // safety: not ourselves

    await supabase.from('messages').delete()
      .eq('sender_username', myUsername).eq('receiver_username', username);
    await supabase.from('messages').delete()
      .eq('sender_username', username).eq('receiver_username', myUsername);

    // Clear from localStorage favorites so InterestChat "Add Friend" re-enables
    try {
      const key = `vibester:favorites:${user.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const list = JSON.parse(raw);
        const updated = list.filter(f => f.username?.toLowerCase() !== username.toLowerCase());
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch { /* ignore */ }

    // Remove from local React state immediately
    setDbFriends(prev => prev.filter(f => f.username !== username));
    // Remove from chat previews
    setChatPreviews(prev => prev.filter(p => p.username !== username));
    // Close chat if it was open with this person
    if (activeDmFriend?.username === username) setActiveDmFriend(null);
  };

  const handleDeleteChat = async (username, e) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: `Delete chat with ${username}?`,
      text: 'All messages will be permanently deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e17055',
      background: 'rgba(8,12,30,0.97)',
      color: '#fff'
    });
    if (!result.isConfirmed) return;

    await supabase.from('messages').delete()
      .eq('sender_username', myUsername).eq('receiver_username', username);
    await supabase.from('messages').delete()
      .eq('sender_username', username).eq('receiver_username', myUsername);

    // Remove from local chat previews
    setChatPreviews(prev => prev.filter(p => p.username !== username));
    // Close DM window if open with this person
    if (activeDmFriend?.username === username) setActiveDmFriend(null);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        background: 'radial-gradient(circle at top, #050816 0%, #02010a 40%, #000000 100%)',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Animations + responsive */}
      <style>{`
        @keyframes logo-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes dice-roll {
          0%   { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          25%  { transform: rotateX(90deg) rotateY(45deg) rotateZ(0deg); }
          50%  { transform: rotateX(180deg) rotateY(90deg) rotateZ(45deg); }
          75%  { transform: rotateX(270deg) rotateY(180deg) rotateZ(90deg); }
          100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(0deg); }
        }
        .dice-scene {
          width: 22px;
          height: 22px;
          perspective: 200px;
          flex-shrink: 0;
        }
        .dice-cube {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: dice-roll 3s ease-in-out infinite;
        }
        .dice-face {
          position: absolute;
          width: 22px;
          height: 22px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          color: #000;
          border: 1.5px solid rgba(0, 0, 0, 0.2);
        }
        .dice-face--front  { background: #fff; transform: translateZ(11px); }
        .dice-face--back   { background: #f0f0f0; transform: rotateY(180deg) translateZ(11px); }
        .dice-face--right  { background: #fff; transform: rotateY(90deg) translateZ(11px); }
        .dice-face--left   { background: #f0f0f0; transform: rotateY(-90deg) translateZ(11px); }
        .dice-face--top    { background: #fff; transform: rotateX(90deg) translateZ(11px); }
        .dice-face--bottom { background: #f0f0f0; transform: rotateX(-90deg) translateZ(11px); }

        .quick-match-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(90deg, rgba(255,0,222,0.15), rgba(183,0,255,0.15));
          border: 1px solid rgba(255,0,222,0.3);
          border-radius: 16px;
          padding: 5px 14px 5px 7px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #fff;
        }
        .quick-match-btn:hover {
          background: linear-gradient(90deg, rgba(255,0,222,0.3), rgba(183,0,255,0.3));
          border-color: rgba(255,0,222,0.6);
          box-shadow: 0 0 20px rgba(255,0,222,0.25);
          transform: scale(1.05);
        }
        .quick-match-text {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        /* Door animation */
        @keyframes door-left {
          0%, 100% { transform: perspective(80px) rotateY(0deg); }
          40%, 60% { transform: perspective(80px) rotateY(-45deg); }
        }
        @keyframes door-right {
          0%, 100% { transform: perspective(80px) rotateY(0deg); }
          40%, 60% { transform: perspective(80px) rotateY(45deg); }
        }
        .door-icon {
          width: 22px;
          height: 22px;
          position: relative;
          display: flex;
          align-items: stretch;
          gap: 1px;
          flex-shrink: 0;
        }
        .door-half {
          flex: 1;
          border-radius: 3px;
          background: linear-gradient(135deg, #00b7ff, #0984e3);
          border: 1px solid rgba(255,255,255,0.2);
          position: relative;
        }
        .door-half--left {
          transform-origin: left center;
          animation: door-left 3s ease-in-out infinite;
          border-radius: 3px 0 0 3px;
        }
        .door-half--right {
          transform-origin: right center;
          animation: door-right 3s ease-in-out infinite;
          border-radius: 0 3px 3px 0;
        }
        .door-half::after {
          content: '';
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #fff;
          top: 50%;
          transform: translateY(-50%);
        }
        .door-half--left::after { right: 2px; }
        .door-half--right::after { left: 2px; }
        .door-frame {
          position: absolute;
          inset: -1px;
          border: 1.5px solid rgba(0, 183, 255, 0.4);
          border-radius: 4px;
          pointer-events: none;
        }

        .create-room-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(90deg, rgba(0,183,255,0.12), rgba(9,132,227,0.12));
          border: 1px solid rgba(0,183,255,0.3);
          border-radius: 16px;
          padding: 5px 14px 5px 7px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #fff;
        }
        .create-room-btn:hover {
          background: linear-gradient(90deg, rgba(0,183,255,0.25), rgba(9,132,227,0.25));
          border-color: rgba(0,183,255,0.6);
          box-shadow: 0 0 20px rgba(0,183,255,0.2);
          transform: scale(1.05);
        }
        .create-room-text {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        /* Friends count badge */
        .friends-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 5px 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .friends-badge:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(0,183,255,0.4);
          box-shadow: 0 0 14px rgba(0,183,255,0.15);
        }
        .friends-badge__count {
          background: linear-gradient(135deg, #00b7ff, #6c5ce7);
          color: #fff;
          border-radius: 99px;
          min-width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          padding: 0 5px;
        }

        /* Friends panel */
        .friends-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .friends-overlay.open { opacity: 1; pointer-events: all; }

        .friends-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 360px;
          max-width: 90vw;
          height: 100vh;
          z-index: 1000;
          background: rgba(8, 12, 30, 0.95);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255,255,255,0.08);
          transform: translateX(100%);
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          box-shadow: -8px 0 40px rgba(0,0,0,0.5);
        }
        .friends-panel.open { transform: translateX(0); }

        .friends-panel__header {
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .friends-panel__title {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1px;
          background: linear-gradient(90deg, #00b7ff, #6c5ce7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .friends-panel__close {
          background: none;
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .friends-panel__close:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(0,183,255,0.5);
        }

        .friends-panel__list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .friends-panel__list::-webkit-scrollbar { width: 4px; }
        .friends-panel__list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

        .friend-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.2s;
        }
        .friend-card:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(0,183,255,0.2);
        }
        .friend-card__avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
          position: relative;
        }
        .friend-card__status {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid rgba(8, 12, 30, 0.95);
        }
        .friend-card__status--online { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        .friend-card__status--offline { background: #6b7280; }
        .friend-card__info {
          flex: 1;
          min-width: 0;
        }
        .friend-card__name {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .friend-card__meta {
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          margin-top: 2px;
        }
        .friend-card__actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .friend-action-btn {
          padding: 5px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .friend-action-btn:hover {
          background: rgba(0,183,255,0.15);
          border-color: rgba(0,183,255,0.4);
        }
        .friend-action-btn--primary {
          background: linear-gradient(90deg, rgba(0,183,255,0.2), rgba(108,92,231,0.2));
          border-color: rgba(0,183,255,0.3);
        }
        .friend-action-btn--primary:hover {
          background: linear-gradient(90deg, rgba(0,183,255,0.35), rgba(108,92,231,0.35));
        }

        /* Chats panel */
        .chats-panel {
          position: fixed;
          top: 0;
          left: 0;
          width: 360px;
          max-width: 92vw;
          height: 100vh;
          z-index: 1000;
          background: rgba(8, 12, 30, 0.97);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(255,255,255,0.08);
          transform: translateX(-100%);
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          box-shadow: 8px 0 40px rgba(0,0,0,0.5);
        }
        .chats-panel.open { transform: translateX(0); }

        .chats-panel__header {
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .chats-panel__title {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1px;
          background: linear-gradient(90deg, #00b7ff, #6c5ce7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .chats-panel__close {
          background: none;
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .chats-panel__close:hover { background: rgba(255,255,255,0.1); }

        .chats-panel__list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
        }
        .chats-panel__list::-webkit-scrollbar { width: 4px; }
        .chats-panel__list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

        .chat-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chat-row:hover { background: rgba(255,255,255,0.06); }
        .chat-row__avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
          position: relative;
        }
        .chat-row__dot {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          border: 2px solid rgba(8,12,30,0.97);
        }
        .chat-row__info { flex: 1; min-width: 0; }
        .chat-row__top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
        }
        .chat-row__name { font-size: 14px; font-weight: 700; }
        .chat-row__time { font-size: 11px; opacity: 0.4; white-space: nowrap; }
        .chat-row__bottom { display: flex; align-items: center; gap: 6px; }
        .chat-row__preview {
          font-size: 12px;
          opacity: 0.5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .chat-row__unread {
          background: linear-gradient(135deg, #00b7ff, #6c5ce7);
          color: #fff;
          border-radius: 99px;
          min-width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          padding: 0 5px;
          flex-shrink: 0;
        }
        .chat-row__delete {
          background: none;
          border: 1px solid rgba(255,118,117,0.35);
          color: rgba(255,118,117,0.7);
          width: 26px;
          height: 26px;
          border-radius: 50%;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-left: 4px;
          transition: all 0.2s;
        }
        .chat-row__delete:hover {
          background: rgba(255,118,117,0.15);
          border-color: rgba(255,118,117,0.7);
          color: #ff7675;
          transform: scale(1.1);
        }

        .chats-nav-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 5px 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }
        .chats-nav-btn:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(0,183,255,0.4);
          box-shadow: 0 0 14px rgba(0,183,255,0.15);
        }
        .chats-nav-btn__badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ff00de;
          color: #fff;
          border-radius: 99px;
          min-width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 900;
          padding: 0 3px;
          border: 1.5px solid rgba(8,12,30,0.95);
        }
        .chats-nav-text { }
        @media (max-width: 600px) {
          .chats-nav-text { display: none !important; }
          .chats-nav-btn { padding: 5px 8px !important; }
        }
        .profile-overlay {
          position: fixed;
          inset: 0;
          z-index: 1100;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .profile-overlay.open { opacity: 1; pointer-events: all; }

        .profile-modal {
          background: rgba(12, 16, 36, 0.97);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 32px 28px;
          width: 320px;
          max-width: 90vw;
          text-align: center;
          transform: scale(0.85);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,183,255,0.08);
          position: relative;
        }
        .profile-overlay.open .profile-modal { transform: scale(1); }

        .profile-modal__close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: none;
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .profile-modal__close:hover { background: rgba(255,255,255,0.1); }

        .profile-modal__avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          position: relative;
        }
        .profile-modal__status {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 3px solid rgba(12, 16, 36, 0.97);
        }
        .profile-modal__name {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .profile-modal__status-text {
          font-size: 12px;
          margin-bottom: 12px;
          opacity: 0.6;
        }
        .profile-modal__bio {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          margin-bottom: 24px;
          line-height: 1.5;
          padding: 0 8px;
        }
        .profile-modal__actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .profile-action-btn {
          flex: 1;
          padding: 10px 0;
          border-radius: 14px;
          border: none;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .profile-action-btn--call {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }
        .profile-action-btn--call:hover {
          box-shadow: 0 0 20px rgba(34,197,94,0.4);
          transform: translateY(-1px);
        }
        .profile-action-btn--text {
          background: linear-gradient(135deg, #00b7ff, #6c5ce7);
        }
        .profile-action-btn--text:hover {
          box-shadow: 0 0 20px rgba(0,183,255,0.4);
          transform: translateY(-1px);
        }

        @media (max-width: 600px) {
          .dash-online-text { display: none !important; }
          .quick-match-text { display: none !important; }
          .create-room-text { display: none !important; }
          .friends-badge span:not(.friends-badge__count) { display: none !important; }
          .friends-badge { padding: 5px 8px !important; }
          .quick-match-btn { padding: 6px 10px !important; border-radius: 14px !important; }
          .create-room-btn { padding: 6px 10px !important; border-radius: 14px !important; }
          .dice-scene { width: 18px; height: 18px; }
          .dice-face { width: 18px; height: 18px; font-size: 9px; }
          .dice-face--front  { transform: translateZ(9px); }
          .dice-face--back   { transform: rotateY(180deg) translateZ(9px); }
          .dice-face--right  { transform: rotateY(90deg) translateZ(9px); }
          .dice-face--left   { transform: rotateY(-90deg) translateZ(9px); }
          .dice-face--top    { transform: rotateX(90deg) translateZ(9px); }
          .dice-face--bottom { transform: rotateX(-90deg) translateZ(9px); }
          .door-icon { width: 18px; height: 18px; }
        }

        /* ── Bottom Dock ── */
        .bottom-dock {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(8, 12, 30, 0.82);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 999px;
          padding: 8px 14px;
          backdrop-filter: blur(24px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset;
        }
        .dock-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 16px;
          transition: all 0.2s ease;
          min-width: 52px;
          position: relative;
        }
        .dock-btn:hover {
          background: rgba(255,255,255,0.08);
          transform: translateY(-2px);
        }
        .dock-btn:active { transform: translateY(0) scale(0.95); }
        .dock-btn__icon {
          font-size: 20px;
          line-height: 1;
        }
        .dock-btn__label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .dock-btn:hover .dock-btn__label { color: rgba(255,255,255,0.9); }
        .dock-btn--active .dock-btn__icon { filter: drop-shadow(0 0 6px #00b7ff); }
        .dock-btn--active .dock-btn__label { color: #00b7ff; }
        .dock-btn--danger:hover { background: rgba(255,60,60,0.12); }
        .dock-btn--danger .dock-btn__label { color: rgba(255,100,100,0.6); }
        .dock-btn--danger:hover .dock-btn__label { color: #ff6b6b; }
        .dock-divider {
          width: 1px;
          height: 32px;
          background: rgba(255,255,255,0.08);
          margin: 0 4px;
          flex-shrink: 0;
        }
        .dock-badge {
          position: absolute;
          top: 2px;
          right: 6px;
          background: #ef4444;
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          border-radius: 999px;
          padding: 1px 5px;
          min-width: 16px;
          text-align: center;
          border: 1.5px solid rgba(8,12,30,0.9);
        }
        /* Logo pill top-left */
        .logo-pill {
          position: fixed;
          top: 14px;
          left: 18px;
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(8,12,30,0.75);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          padding: 6px 14px 6px 8px;
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .logo-pill__name {
          font-size: 13px;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0.5px;
          opacity: 0.9;
        }
        .online-dot {
          position: fixed;
          top: 20px;
          right: 18px;
          z-index: 200;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(8,12,30,0.75);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          padding: 6px 12px;
          backdrop-filter: blur(16px);
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          font-weight: 600;
        }
        @media (max-width: 480px) {
          .bottom-dock { padding: 6px 8px; gap: 0; bottom: 12px; }
          .dock-btn { padding: 5px 7px; min-width: 42px; }
          .dock-btn__icon { font-size: 18px; }
          .dock-btn__label { font-size: 9px; }
          .logo-pill__name { display: none; }
        }
      `}</style >

      {/* Minimal Logo Pill — top left */}
      <div className="logo-pill">
        <img
          src="/logo_vibester.png"
          alt="Vibester"
          style={{ width: 26, height: 26, borderRadius: '50%', filter: 'drop-shadow(0 0 6px rgba(0,183,255,0.5))' }}
        />
        <span className="logo-pill__name">Vibester</span>
      </div>

      {/* Online dot — top right */}
      <div className="online-dot">
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', flexShrink: 0 }} />
        Online
      </div>

      {/* ── Bottom Dock ── */}
      <nav className="bottom-dock">
        {/* Chats */}
        <button className="dock-btn" onClick={() => setShowChatsPanel(true)} title="Chats">
          {totalUnread > 0 && <span className="dock-badge">{totalUnread}</span>}
          <span className="dock-btn__icon">💬</span>
          <span className="dock-btn__label">Chats</span>
        </button>

        {/* Friends */}
        <button className="dock-btn" onClick={() => setShowFriendsPanel(true)} title="Friends">
          <span className="dock-btn__icon">👥</span>
          <span className="dock-btn__label">{people.length} Friends</span>
        </button>

        <div className="dock-divider" />

        {/* Quick Match */}
        <button className="dock-btn dock-btn--active" onClick={handleQuickMatch} title="Quick Match">
          <div className="dice-scene" style={{ width: 22, height: 22 }}>
            <div className="dice-cube">
              <div className="dice-face dice-face--front">•</div>
              <div className="dice-face dice-face--back">••</div>
              <div className="dice-face dice-face--right">•••</div>
              <div className="dice-face dice-face--left">••</div>
              <div className="dice-face dice-face--top">•••</div>
              <div className="dice-face dice-face--bottom">•</div>
            </div>
          </div>
          <span className="dock-btn__label">Quick Match</span>
        </button>

        {/* Create Room */}
        <button className="dock-btn" onClick={() => navigate('/chatlanding')} title="Create Room">
          <span className="dock-btn__icon">🚪</span>
          <span className="dock-btn__label">Create Room</span>
        </button>

        <div className="dock-divider" />

        {/* Home */}
        <button className="dock-btn" onClick={() => navigate('/Home')} title="Home">
          <span className="dock-btn__icon">🏠</span>
          <span className="dock-btn__label">Home</span>
        </button>

        {/* Logout */}
        <button
          className="dock-btn dock-btn--danger"
          title="Logout"
          onClick={async () => {
            localStorage.removeItem('username');
            if (user) localStorage.removeItem(`vibester:favorites:${user.id}`);
            await supabase.auth.signOut();
            navigate('/Home');
          }}
        >
          <span className="dock-btn__icon">⏻</span>
          <span className="dock-btn__label">Logout</span>
        </button>
      </nav>

      {/* Chats Panel Overlay */}
      <div className={`friends-overlay${showChatsPanel ? ' open' : ''}`} onClick={() => setShowChatsPanel(false)} />
      <div className={`chats-panel${showChatsPanel ? ' open' : ''}`}>
        <div className="chats-panel__header">
          <span className="chats-panel__title">Messages</span>
          <button className="chats-panel__close" onClick={() => setShowChatsPanel(false)}>✕</button>
        </div>
        <div className="chats-panel__list">
          {chatPreviews.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              No conversations yet.<br />
              Tap a friend to start chatting!
            </div>
          ) : (
            chatPreviews.map((p, i) => {
              const initials = p.username.slice(0, 2).toUpperCase();
              const gradients = [
                ['#00b7ff', '#6c5ce7'], ['#fd79a8', '#e17055'], ['#00cec9', '#0984e3'],
                ['#fdcb6e', '#e17055'], ['#a29bfe', '#6c5ce7'], ['#55efc4', '#00b894'],
                ['#fab1a0', '#e17055'], ['#74b9ff', '#0984e3'],
              ];
              const grad = gradients[i % gradients.length];
              return (
                <div
                  key={p.username + i}
                  className="chat-row"
                  onClick={() => {
                    setShowChatsPanel(false);
                    handleTextFriend(p.username);
                  }}
                >
                  <div className="chat-row__avatar" style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
                    {initials}
                    <span className="chat-row__dot" style={{ background: p.isOnline ? '#22c55e' : '#6b7280', boxShadow: p.isOnline ? '0 0 5px #22c55e' : 'none' }} />
                  </div>
                  <div className="chat-row__info">
                    <div className="chat-row__top">
                      <span className="chat-row__name" style={{ fontWeight: p.unread ? 800 : 600 }}>{p.username}</span>
                      <span className="chat-row__time">{p.time}</span>
                    </div>
                    <div className="chat-row__bottom">
                      <span className="chat-row__preview" style={{ opacity: p.unread ? 0.8 : 0.45, fontWeight: p.unread ? 600 : 400 }}>{p.lastMessage}</span>
                      {p.unread > 0 && <span className="chat-row__unread">{p.unread}</span>}
                    </div>
                  </div>
                  <button
                    className="chat-row__delete"
                    onClick={(e) => handleDeleteChat(p.username, e)}
                    title={`Delete chat with ${p.username}`}
                  >🗑</button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Friends Panel Overlay */}
      <div className={`friends-overlay${showFriendsPanel ? ' open' : ''}`} onClick={() => setShowFriendsPanel(false)} />
      <div className={`friends-panel${showFriendsPanel ? ' open' : ''}`}>
        <div className="friends-panel__header">
          <span className="friends-panel__title">Connections ({people.length})</span>
          <button className="friends-panel__close" onClick={() => setShowFriendsPanel(false)}>✕</button>
        </div>
        <div className="friends-panel__list">
          {requests.length > 0 && (
            <div className="friends-section">
              <div className="friends-section-title" style={{ fontSize: '10px', color: '#00b7ff', fontWeight: 800, padding: '10px 5px', opacity: 0.8 }}>REQUESTS ({requests.length})</div>
              {requests.map((req) => (
                <div key={req.username} className="friend-card" style={{ border: '1px solid rgba(255,121,198,0.3)', background: 'rgba(255,121,198,0.05)' }}>
                  <div className="friend-card__avatar" style={{ background: 'linear-gradient(135deg, #fd79a8, #e17055)' }}>
                    {req.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="friend-card__info">
                    <div className="friend-card__name">{req.username}</div>
                    <div className="friend-card__meta">Wants to message you</div>
                  </div>
                  <div className="friend-card__actions">
                    <button
                      className="friend-action-btn friend-action-btn--primary"
                      onClick={() => handleTextFriend({ username: req.username, isOnline: true })}
                    >
                      Add Back
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="friends-section">
            <div className="friends-section-title" style={{ fontSize: '10px', color: '#00b7ff', fontWeight: 800, padding: '10px 5px', opacity: 0.8 }}>CONNECTIONS ({people.length})</div>
            {people.map((p, i) => {
              const initials = p.username.slice(0, 2).toUpperCase();
              const gradients = [
                ['#00b7ff', '#6c5ce7'], ['#fd79a8', '#e17055'], ['#00cec9', '#0984e3'],
                ['#fdcb6e', '#e17055'], ['#a29bfe', '#6c5ce7'], ['#55efc4', '#00b894'],
                ['#fab1a0', '#e17055'], ['#74b9ff', '#0984e3'],
              ];
              const grad = gradients[i % gradients.length];
              return (
                <div className="friend-card" key={p.username + i}>
                  <div
                    className="friend-card__avatar"
                    style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}
                  >
                    {initials}
                    <span className={`friend-card__status friend-card__status--${p.isOnline ? 'online' : 'offline'}`} />
                  </div>
                  <div className="friend-card__info">
                    <div className="friend-card__name">{p.username}</div>
                    <div className="friend-card__meta">{p.isOnline ? '🟢 Online' : '⚫ Offline'}</div>
                  </div>
                  <div className="friend-card__actions">
                    <button className="friend-action-btn friend-action-btn--primary" onClick={() => handleTextFriend(p)}>💬 Text</button>
                    <button
                      className="friend-action-btn"
                      onClick={() => handleRemoveFriend(p.username)}
                      style={{ color: '#ff7675', borderColor: 'rgba(255,118,117,0.3)' }}
                      title={`Remove ${p.username}`}
                    >✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main style={{ flex: 1, position: 'relative', marginTop: 10 }}>
        {/* DotGrid background — sits behind the dome */}
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 0, pointerEvents: 'none',
          overflow: 'hidden',
        }}>
          <DotGrid
            dotSize={5}
            gap={15}
            baseColor="#271E37"
            activeColor="#5227FF"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>
        {/* Dome sits above the dot grid */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
          <DomeGallery
            people={people}
            onPersonClick={(person) => setSelectedPerson(person)}
            fit={0.8}
            minRadius={600}
            maxVerticalRotationDeg={0}
            segments={34}
            dragDampening={2}
          />
        </div>
      </main>

      {/* Profile Modal */}
      <div
        className={`profile-overlay${selectedPerson ? ' open' : ''}`}
        onClick={() => setSelectedPerson(null)}
      >
        {selectedPerson && (
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="profile-modal__close" onClick={() => setSelectedPerson(null)}>✕</button>
            <div
              className="profile-modal__avatar"
              style={{
                background: `linear-gradient(135deg, ${(
                  [
                    ['#00b7ff', '#6c5ce7'], ['#fd79a8', '#e17055'], ['#00cec9', '#0984e3'],
                    ['#fdcb6e', '#e17055'], ['#a29bfe', '#6c5ce7'], ['#55efc4', '#00b894'],
                    ['#fab1a0', '#e17055'], ['#74b9ff', '#0984e3'],
                  ][(people.indexOf(selectedPerson) === -1 ? 0 : people.indexOf(selectedPerson)) % 8].join(', ')
                )})`,
              }}
            >
              {selectedPerson.username.slice(0, 2).toUpperCase()}
              <span
                className="profile-modal__status"
                style={{
                  background: selectedPerson.isOnline ? '#22c55e' : '#6b7280',
                  boxShadow: selectedPerson.isOnline ? '0 0 8px #22c55e' : 'none',
                }}
              />
            </div>
            <div className="profile-modal__name">{selectedPerson.username}</div>
            <div className="profile-modal__status-text">
              {selectedPerson.isOnline ? '🟢 Online now' : '⚫ Last seen recently'}
            </div>
            <div className="profile-modal__bio">{getPersonBio(selectedPerson.username)}</div>
            <div className="profile-modal__actions">
              <button
                className="profile-action-btn profile-action-btn--call"
                onClick={() => { setSelectedPerson(null); navigate('/voicecall'); }}
              >
                📞 Call
              </button>
              <button
                className="profile-action-btn profile-action-btn--text"
                onClick={() => { handleTextFriend(selectedPerson); setSelectedPerson(null); }}
              >
                💬 Text
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard DM Chat Window */}
      {activeDmFriend && (
        <DashboardChat
          user={user}
          friend={activeDmFriend}
          onClose={() => setActiveDmFriend(null)}
          onMessageSent={(recipientUsername, text) => {
            setChatPreviews((prev) => {
              const personObj = people.find((p) => p.username === recipientUsername)
                || { username: recipientUsername, isOnline: false };
              const newEntry = { ...personObj, lastMessage: text, time: 'just now', unread: 0 };
              const filtered = prev.filter((p) => p.username !== recipientUsername);
              return [newEntry, ...filtered];
            });
          }}
          onDeleteChat={(deletedUsername) => {
            setChatPreviews((prev) => prev.filter((p) => p.username !== deletedUsername));
            setActiveDmFriend(null);
          }}
        />
      )}
    </div>
  );
};

export default UserDashboard;
