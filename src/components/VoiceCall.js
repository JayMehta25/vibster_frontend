import React, { useRef, useState, useEffect } from 'react';
import socket from '../socket';
import { useLocation, useNavigate } from 'react-router-dom';

function VoiceCall() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomCode, username, fromInterestChat } = location.state || {};

  const [room, setRoom] = useState(''); // Start with empty room code
  const [joined, setJoined] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const localAudio = useRef();
  const peers = useRef({});
  const localStream = useRef();

  useEffect(() => {
    // Don't auto-join, let user click the join button
    // if (roomCode && !joined) {
    //   joinRoom();
    // }
  }, [roomCode]);

  useEffect(() => {
    return () => {
      Object.values(peers.current).forEach(pc => pc.close());
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const joinRoom = async () => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudio.current) localAudio.current.srcObject = localStream.current;
      setupSocket();

      const joinData = {
        room,
        username: username || 'User_' + Math.floor(Math.random() * 1000)
      };

      console.log('Joining with data:', joinData);

      if (socket.connected) {
        socket.emit('join', joinData);
      } else {
        socket.once('connect', () => socket.emit('join', joinData));
      }
      setJoined(true);
    } catch (e) {
      alert('Microphone access denied.');
    }
  };

  function setupSocket() {
    socket.off('peers');
    socket.off('new-peer');
    socket.off('peer-disconnected');
    socket.off('signal');
    socket.off('participants-list');
    socket.off('user-count');

    socket.on('peers', ({ peers: peerIds }) => {
      peerIds.forEach(socketId => {
        if (socketId !== socket.id) createPeer(socketId, true);
      });
    });
    socket.on('new-peer', ({ peerId }) => {
      if (peerId !== socket.id) createPeer(peerId, false);
    });
    socket.on('peer-disconnected', socketId => {
      if (peers.current[socketId]) {
        peers.current[socketId].close();
        delete peers.current[socketId];
        setRemoteStreams(prev => {
          const copy = { ...prev };
          delete copy[socketId];
          return copy;
        });
      }
    });
    socket.on('signal', async ({ from, data }) => {
      let pc = peers.current[from];
      if (!pc) pc = createPeer(from, false);
      try {
        if (data.sdp) {
          if (data.sdp.type === 'offer') {
            if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer') {
              return;
            }
            await pc.setRemoteDescription(new window.RTCSessionDescription(data.sdp));
            if (pc.signalingState === 'have-remote-offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit('signal', { to: from, data: { sdp: pc.localDescription } });
            }
          } else if (data.sdp.type === 'answer') {
            await pc.setRemoteDescription(new window.RTCSessionDescription(data.sdp));
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(new window.RTCIceCandidate(data.candidate));
        }
      } catch { }
    });

    socket.on('participants-list', (list) => {
      console.log('Received participants list:', list);
      setParticipants(list);
    });

    socket.on('user-count', (count) => {
      console.log('User count:', count);
    });
  }

  function createPeer(socketId, isInitiator) {
    const pc = new window.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });
    peers.current[socketId] = pc;
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));
    }
    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('signal', { to: socketId, data: { candidate: e.candidate } });
    };
    pc.ontrack = e => {
      setRemoteStreams(prev => ({ ...prev, [socketId]: e.streams[0] }));
    };
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', { to: socketId, data: { sdp: pc.localDescription } });
        } catch { }
      };
    }
    return pc;
  }

  const handleBack = () => {
    if (fromInterestChat) {
      navigate('/interest-chat', { state: { username, returning: true } });
    } else {
      navigate('/chatmain', { state: { roomCode: room, username } });
    }
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @media (max-width: 768px) {
          .voice-call-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 15px;
          }
          .back-button {
            position: static !important;
            width: 100%;
            margin-bottom: 10px;
          }
          .voice-call-content {
            padding: 20px !important;
          }
        }
      `}</style>

      <div style={styles.header} className="voice-call-header">
        <h2 style={styles.title}>Group Voice Chat</h2>
        <button
          onClick={handleBack}
          style={styles.backButton}
          className="back-button"
        >
          Back to Chat
        </button>
      </div>

      {/* Room Code Banner - Shows when joined */}
      {joined && room && (
        <div style={styles.roomCodeBanner}>
          <div style={styles.roomCodeContent}>
            <span style={styles.roomCodeLabel}>Room Code:</span>
            <span style={styles.roomCodeText}>{room.toUpperCase()}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(room);
                alert('Room code copied to clipboard!');
              }}
              style={styles.copyButton}
              title="Copy room code"
            >
              📋 Copy
            </button>
          </div>
          <p style={styles.roomCodeHint}>Share this code with others to join the call</p>
        </div>
      )}


      <div style={styles.content} className="voice-call-content">
        {!joined ? (
          <div style={styles.joinSection}>
            <p style={styles.roomLabel}>Enter Room Code to Join Voice Call</p>
            <input
              type="text"
              placeholder="Enter Room Code"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '300px',
                padding: '12px 16px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '2px solid #ddd',
                marginBottom: '20px',
                textAlign: 'center',
                textTransform: 'uppercase'
              }}
            />
            <button
              onClick={joinRoom}
              disabled={!room}
              style={styles.joinButton}
            >
              Join Voice Call
            </button>
          </div>
        ) : (
          <>
            <div style={styles.connectedSection}>
              <p style={styles.connectedText}>✓ Connected to Room: <strong>{room}</strong></p>
            </div>

            {/* Mute/Unmute Control */}
            <div style={{ textAlign: 'center', marginTop: '30px' }}>
              <button
                onClick={toggleMute}
                style={{
                  width: '60px',
                  height: '60px',
                  fontSize: '24px',
                  backgroundColor: isMuted ? '#dc3545' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto'
                }}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Floating Avatars */}
            <div style={styles.floatingContainer}>
              <style>{`
                @keyframes float {
                  0%, 100% { transform: translateY(0px) translateX(0px); }
                  25% { transform: translateY(-20px) translateX(10px); }
                  50% { transform: translateY(-10px) translateX(-10px); }
                  75% { transform: translateY(-15px) translateX(5px); }
                }
                @keyframes pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(26, 115, 232, 0.7); }
                  50% { box-shadow: 0 0 0 15px rgba(26, 115, 232, 0); }
                }
                .floating-avatar {
                  animation: float 6s ease-in-out infinite;
                }
                .speaking {
                  animation: float 6s ease-in-out infinite, pulse 2s ease-in-out infinite;
                }
              `}</style>

              <div style={styles.participantCount}>
                <span style={styles.countBadge}>{joined ? participants.length + 1 : 0}</span>
                <span style={styles.countLabel}>in call</span>
              </div>

              {/* Local User Avatar */}
              <div
                className="floating-avatar"
                style={{
                  ...styles.floatingAvatar,
                  top: '20%',
                  left: '15%',
                  animationDelay: '0s'
                }}
              >
                <div style={styles.avatarCircle}>
                  {username.charAt(0).toUpperCase()}
                </div>
                <div style={styles.avatarName}>{username} (You)</div>
              </div>

              {/* Remote Users Avatars */}
              {participants.filter(p => p.username !== username).map((participant, index) => {
                const positions = [
                  { top: '25%', left: '70%' },
                  { top: '50%', left: '20%' },
                  { top: '45%', left: '75%' },
                  { top: '65%', left: '40%' },
                  { top: '30%', left: '45%' },
                ];
                const position = positions[index % positions.length];

                return (
                  <div
                    key={participant.id}
                    className="floating-avatar"
                    style={{
                      ...styles.floatingAvatar,
                      ...position,
                      animationDelay: `${index * 1.2}s`
                    }}
                  >
                    <div style={styles.avatarCircle}>
                      {participant.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.avatarName}>{participant.username}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Hidden audio elements */}
        <audio ref={localAudio} autoPlay muted playsInline />
        {Object.entries(remoteStreams).map(([id, stream]) => (
          <audio
            key={id}
            ref={el => {
              if (el && stream) {
                el.srcObject = stream;
                el.volume = 1.0; // Ensure volume is at maximum
                el.onloadedmetadata = () => {
                  el.play().catch(err => {
                    console.log('Audio play error:', err);
                  });
                };
              }
            }}
            autoPlay
            playsInline
            style={{ display: 'none' }}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '20px',
    boxSizing: 'border-box',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.5rem, 5vw, 2rem)',
    color: '#333'
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: 'black',
    color: 'white',
    border: '1px solid white',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'all 0.3s ease'
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '30px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  joinSection: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  roomLabel: {
    fontSize: 'clamp(1rem, 3vw, 1.2rem)',
    marginBottom: '20px',
    color: '#666'
  },
  roomCode: {
    color: '#007bff',
    fontSize: 'clamp(1.1rem, 3.5vw, 1.3rem)'
  },
  joinButton: {
    padding: '15px 40px',
    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    width: '100%',
    maxWidth: '300px'
  },
  connectedSection: {
    textAlign: 'center',
    padding: '30px 20px',
    backgroundColor: '#e8f5e9',
    borderRadius: '8px'
  },
  connectedText: {
    fontSize: 'clamp(1rem, 3vw, 1.2rem)',
    color: '#2e7d32',
    margin: 0
  },
  floatingContainer: {
    position: 'relative',
    minHeight: '400px',
    marginTop: '40px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  participantCount: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'white',
    padding: '10px 20px',
    borderRadius: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    zIndex: 10
  },
  countBadge: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1a73e8'
  },
  countLabel: {
    fontSize: '14px',
    color: '#666'
  },
  floatingAvatar: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'transform 0.3s ease'
  },
  avatarCircle: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    backgroundColor: '#1a73e8',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 'bold',
    boxShadow: '0 4px 12px rgba(26, 115, 232, 0.3)',
    border: '3px solid white'
  },
  avatarName: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  roomCodeBanner: {
    backgroundColor: '#1a73e8',
    color: 'white',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(26, 115, 232, 0.3)',
    textAlign: 'center'
  },
  roomCodeContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    flexWrap: 'wrap',
    marginBottom: '10px'
  },
  roomCodeLabel: {
    fontSize: '16px',
    fontWeight: '500',
    opacity: 0.9
  },
  roomCodeText: {
    fontSize: '28px',
    fontWeight: 'bold',
    letterSpacing: '3px',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: '8px 20px',
    borderRadius: '8px',
    border: '2px solid rgba(255, 255, 255, 0.3)'
  },
  copyButton: {
    backgroundColor: 'white',
    color: '#1a73e8',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
  },
  roomCodeHint: {
    fontSize: '14px',
    margin: 0,
    opacity: 0.9,
    fontStyle: 'italic'
  }
};

export default VoiceCall;
