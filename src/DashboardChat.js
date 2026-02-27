import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const GRADIENTS = [
  ['#00b7ff', '#6c5ce7'], ['#fd79a8', '#e17055'], ['#00cec9', '#0984e3'],
  ['#fdcb6e', '#e17055'], ['#a29bfe', '#6c5ce7'], ['#55efc4', '#00b894'],
  ['#fab1a0', '#e17055'], ['#74b9ff', '#0984e3'],
];

function getGrad(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffff;
  return GRADIENTS[h % GRADIENTS.length];
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardChat({ user, friend, onClose, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const myUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Me';
  const grad = getGrad(friend.username);

  // Fetch message history between me and this friend
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_username.eq.${friend.username}),` +
        `and(receiver_username.eq.${myUsername},sender_username.eq.${friend.username})`
      )
      .order('sent_at', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          // 403 = RLS not set up yet; show empty state gracefully
          console.debug('[DashboardChat] messages fetch skipped (RLS not configured):', error.code);
        }
        setMessages(data || []);
        setLoading(false);
      });
  }, [user, friend.username, myUsername]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const text = input.trim();
    setInput('');

    // Optimistic UI
    const optimistic = {
      id: 'temp-' + Date.now(),
      sender_id: user.id,
      sender_username: myUsername,
      receiver_username: friend.username,
      content: text,
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    // Instantly notify parent to update chats panel preview
    onMessageSent?.(friend.username, text);

    // Save to Supabase
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      sender_username: myUsername,
      receiver_username: friend.username,
      content: text,
    }).select().single();

    if (error) {
      // 403 = RLS policy not added yet — optimistic message stays visible
      console.debug('[DashboardChat] message save skipped (RLS not configured):', error.code);
      return;
    }
    if (data) {
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? data : m));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <style>{`
        .dchat-window {
          position: fixed;
          bottom: 20px;
          right: 24px;
          width: 340px;
          max-width: calc(100vw - 32px);
          height: 480px;
          max-height: calc(100vh - 80px);
          background: rgba(8, 12, 30, 0.97);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,183,255,0.06);
          z-index: 1200;
          backdrop-filter: blur(20px);
          animation: dchat-slide-up 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        @keyframes dchat-slide-up {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        .dchat-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .dchat-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          color: #fff;
          flex-shrink: 0;
          position: relative;
        }
        .dchat-avatar__dot {
          position: absolute;
          bottom: 0; right: 0;
          width: 9px; height: 9px;
          border-radius: 50%;
          border: 2px solid rgba(8,12,30,0.97);
        }
        .dchat-header__info { flex: 1; min-width: 0; }
        .dchat-header__name {
          font-size: 14px;
          font-weight: 800;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dchat-header__status {
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          margin-top: 1px;
        }
        .dchat-close {
          background: none;
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          width: 28px; height: 28px;
          border-radius: 50%;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .dchat-close:hover { background: rgba(255,255,255,0.1); }

        .dchat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dchat-messages::-webkit-scrollbar { width: 3px; }
        .dchat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }

        .dchat-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.3);
          font-size: 13px;
          gap: 8px;
          text-align: center;
        }
        .dchat-empty__icon { font-size: 32px; }

        .dchat-bubble-wrap {
          display: flex;
          flex-direction: column;
        }
        .dchat-bubble-wrap--mine { align-items: flex-end; }
        .dchat-bubble-wrap--theirs { align-items: flex-start; }

        .dchat-bubble {
          max-width: 75%;
          padding: 8px 12px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.45;
          word-break: break-word;
        }
        .dchat-bubble--mine {
          background: linear-gradient(135deg, #00b7ff, #6c5ce7);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .dchat-bubble--theirs {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.9);
          border-bottom-left-radius: 4px;
        }
        .dchat-bubble__time {
          font-size: 10px;
          margin-top: 3px;
          opacity: 0.4;
          padding: 0 4px;
        }

        .dchat-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .dchat-input {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 8px 14px;
          color: #fff;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }
        .dchat-input::placeholder { color: rgba(255,255,255,0.3); }
        .dchat-input:focus { border-color: rgba(0,183,255,0.4); }
        .dchat-send {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #00b7ff, #6c5ce7);
          border: none;
          color: #fff;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .dchat-send:hover { transform: scale(1.08); box-shadow: 0 0 14px rgba(0,183,255,0.4); }
        .dchat-send:active { transform: scale(0.96); }

        .dchat-loading {
          text-align: center;
          padding: 20px;
          color: rgba(255,255,255,0.3);
          font-size: 12px;
        }
      `}</style>

      <div className="dchat-window">
        {/* Header */}
        <div className="dchat-header">
          <div className="dchat-avatar" style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
            {friend.username.slice(0, 2).toUpperCase()}
            <span
              className="dchat-avatar__dot"
              style={{ background: friend.isOnline ? '#22c55e' : '#6b7280', boxShadow: friend.isOnline ? '0 0 5px #22c55e' : 'none' }}
            />
          </div>
          <div className="dchat-header__info">
            <div className="dchat-header__name">{friend.username}</div>
            <div className="dchat-header__status">{friend.isOnline ? '🟢 Online' : '⚫ Offline'}</div>
          </div>
          <button className="dchat-close" onClick={onClose}>✕</button>
        </div>

        {/* Messages */}
        <div className="dchat-messages">
          {loading ? (
            <div className="dchat-loading">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="dchat-empty">
              <span className="dchat-empty__icon">💬</span>
              <span>No messages yet.<br />Say hello to {friend.username}!</span>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === user.id || m.sender_username === myUsername;
              return (
                <div key={m.id} className={`dchat-bubble-wrap dchat-bubble-wrap--${isMine ? 'mine' : 'theirs'}`}>
                  <div className={`dchat-bubble dchat-bubble--${isMine ? 'mine' : 'theirs'}`}>
                    {m.content}
                  </div>
                  <span className="dchat-bubble__time">{formatTime(m.sent_at)}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="dchat-input-row">
          <input
            ref={inputRef}
            className="dchat-input"
            placeholder={`Message ${friend.username}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="dchat-send" onClick={handleSend} title="Send">
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
