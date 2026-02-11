import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socket from '../socket';
import './VideoCall.css';

const iceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
];

function VideoCall() {
  const location = useLocation();
  const navigate = useNavigate();
  const roomCode = location.state?.roomCode || '';
  const username = location.state?.username || '';
  const [joined, setJoined] = useState(false);
  const [userIds, setUserIds] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participantCount, setParticipantCount] = useState(1);
  const localVideo = useRef(null);
  const localStream = useRef(null);
  const peers = useRef({});

  // Check if we have a valid room code from InterestChat on component mount
  useEffect(() => {
    if (!roomCode) {
      console.warn("No room code provided - video call must be accessed from InterestChat");
    } else {
      console.log(`Video call opened for chat room: ${roomCode}`);
    }
  }, [roomCode]);
  
  useEffect(() => {
    return () => {
      // Clean up listeners when component unmounts
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('user-count');
      socket.off('signal');
      socket.off('error');
      
      // Close all peer connections
      Object.values(peers.current).forEach(pc => {
        if (pc && pc.close) pc.close();
      });
      peers.current = {};
      
      // Stop all media tracks
      if (localStream.current) {
        localStream.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [joined]);

  const joinRoom = async () => {
    // Only join if we have a valid room code from InterestChat
    if (!roomCode) {
      console.error("No room code provided - video call must be started from InterestChat");
      return;
    }
    
    // Join room immediately to speed up connection
    // We're using the same roomCode from InterestChat to maintain the link
    socket.emit('join', roomCode);
    setJoined(true);
    setUserIds([socket.id]);
    setParticipantCount(1);
    
    // Clean up and set up socket listeners fresh
    setupSocketListeners();
    
    // Get media asynchronously with iOS/mobile friendly constraints
    try {
      const constraints = {
        audio: true,
        video: {
          width: { ideal: 320, max: 480 },
          height: { ideal: 240, max: 360 }
        }
      };
      
      // Try with default constraints
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (initialError) {
        console.warn('Initial getUserMedia failed, trying fallback constraints', initialError);
        
        // Fallback for iOS/Safari - simplified constraints
        localStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
      }
      
      if (localVideo.current) {
        localVideo.current.srcObject = localStream.current;
      }
      
      // Replace tracks in existing peer connections
      if (localStream.current) {
        const audioTrack = localStream.current.getAudioTracks()[0];
        const videoTrack = localStream.current.getVideoTracks()[0];
        
        Object.values(peers.current).forEach(pc => {
          if (pc && pc.signalingState !== 'closed') {
            const senders = pc.getSenders();
            
            if (audioTrack) {
              const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
              if (audioSender) audioSender.replaceTrack(audioTrack);
            }
            
            if (videoTrack) {
              const videoSender = senders.find(s => s.track && s.track.kind === 'video');
              if (videoSender) videoSender.replaceTrack(videoTrack);
            }
          }
        });
      }
    } catch (e) {
      // No camera/mic, but already joined room
      console.warn('Media access error:', e);
      localStream.current = null;
      if (localVideo.current) localVideo.current.srcObject = null;
    }
  };

  const setupSocketListeners = () => {
    // Clear previous listeners if any
    socket.off('all-users');
    socket.off('user-joined');
    socket.off('user-left');
    socket.off('user-count');
    socket.off('signal');
    socket.off('error');

    // Listen for server errors
    socket.on('error', ({ message }) => {
      console.error(`Server error: ${message}`);
      alert(`Video call error: ${message}`);
    });

    // Existing users in room when we join
    socket.on('all-users', (users = []) => {
      const peersInRoom = users.filter(id => id && id !== socket.id);
      setUserIds([socket.id, ...peersInRoom]);
      setParticipantCount(peersInRoom.length + 1);
      peersInRoom.forEach(id => createPeerConnection(id, true));
    });

    // New user joined after us
    socket.on('user-joined', (peerId) => {
      if (!peerId || peerId === socket.id) return;
      setUserIds(prev => prev.includes(peerId) ? prev : [...prev, peerId]);
      setParticipantCount(prev => prev + 1);
      createPeerConnection(peerId, false);
    });

    // User left call
    socket.on('user-left', (id) => {
      if (!id) return;
      setParticipantCount(prev => Math.max(1, prev - 1));

      setUserIds(prev => prev.filter(uid => uid !== id));

      if (peers.current[id]) {
        try {
          const pc = peers.current[id];
          pc.getSenders().forEach(sender => {
            if (sender.track) sender.track.stop();
          });
          pc.close();
        } catch (e) {
          console.warn('Error during peer cleanup:', e);
        }
        delete peers.current[id];
      }

      setRemoteStreams(prev => {
        const copy = { ...prev };
        if (copy[id]) {
          try {
            copy[id].getTracks().forEach(track => track.stop());
          } catch (e) {
            console.warn('Error stopping remote tracks:', e);
          }
          delete copy[id];
        }
        return copy;
      });
    });

    // Participant count updates
    socket.on('user-count', (count) => {
      if (typeof count === 'number' && count > 0) {
        setParticipantCount(count);
      }
    });
    
    socket.on('signal', async ({ from, data }) => {
      // Check if peer exists and connection is valid
      if (!from || !peers.current || !data) return;
      
      let pc = peers.current[from];
      
      // If peer connection doesn't exist or is closed, ignore or create new one
      if (!pc) {
        pc = createPeerConnection(from, false);
      } else if (pc.signalingState === 'closed') {
        // If closed, remove and recreate
        delete peers.current[from];
        pc = createPeerConnection(from, false);
      }
      
      // Safety check again
      if (!pc || pc.signalingState === 'closed') return;
      
      try {
        if (data.type === 'offer') {
          // For offer, we should be in stable state or have-remote-offer
          // If we're in have-local-offer state, we need to rollback first
          if (pc.signalingState === 'have-local-offer') {
            console.log('Rollback from have-local-offer before applying offer');
            try {
              await pc.setLocalDescription({type: "rollback"});
            } catch (e) {
              console.warn('Rollback failed, may not be supported:', e);
              return; // Skip this offer if we can't rollback
            }
          }
          else if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
            console.log('Cannot handle offer in state:', pc.signalingState);
            return;
          }
          
          // Now we can safely set remote description
          await pc.setRemoteDescription(new window.RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, data: pc.localDescription });
        } 
        else if (data.type === 'answer') {
          // For answer, we should only proceed if we're in have-local-offer state
          if (pc.signalingState !== 'have-local-offer') {
            console.log('Cannot handle answer in state:', pc.signalingState);
            return;
          }
          
          await pc.setRemoteDescription(new window.RTCSessionDescription(data));
        } 
        else if (data.candidate) {
          // Only add candidates if connection is in valid state
          if (pc.signalingState !== 'closed') {
            try {
              await pc.addIceCandidate(new window.RTCIceCandidate(data));
            } catch (err) {
              console.warn('ICE candidate error:', err.message);
            }
          }
        }
      } catch (err) {
        console.error('WebRTC signal error:', err.message);
      }
    });
  };

  const createPeerConnection = (id, isInitiator) => {
    // Close and remove any existing connection
    if (peers.current[id]) {
      try {
        peers.current[id].close();
      } catch (e) {
        console.warn('Error closing previous connection', e);
      }
      delete peers.current[id];
    }
    
    // Create new connection with fixed configuration
    // Using a safer configuration that works better across devices
    const pc = new window.RTCPeerConnection({ 
      iceServers,
      iceCandidatePoolSize: 10,
      sdpSemantics: 'unified-plan',
      // Disable trickle ICE for more reliable connections
      iceTransportPolicy: 'all'
    });
    
    peers.current[id] = pc;
    pc.negotiating = false;
    
    // Monitor connection state for debugging
    pc.oniceconnectionstatechange = () => {
      console.log(`Connection to ${id}: ${pc.iceConnectionState}`);
    };
    
    // Create stable media stream format with transceivers
    const audioTransceiver = pc.addTransceiver('audio', {direction: 'sendrecv'});
    const videoTransceiver = pc.addTransceiver('video', {direction: 'sendrecv'});
    
    // Set tracks if we have a stream
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      const videoTrack = localStream.current.getVideoTracks()[0];
      
      if (audioTrack) audioTransceiver.sender.replaceTrack(audioTrack);
      if (videoTrack) videoTransceiver.sender.replaceTrack(videoTrack);
    }
    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('signal', { to: id, data: e.candidate });
    };
    pc.ontrack = e => {
      const remoteStream = e.streams[0];
      setRemoteStreams(prev => {
        // Only update if stream is new or changed
        if (!prev[id] || prev[id].id !== remoteStream.id) {
          return { ...prev, [id]: remoteStream };
        }
        return prev;
      });
      
      // Play remote audio if available
      if (remoteStream.getAudioTracks().length > 0) {
        let remoteAudio = document.getElementById(`remoteAudio-${id}`);
        if (!remoteAudio) {
          remoteAudio = document.createElement('audio');
          remoteAudio.id = `remoteAudio-${id}`;
          remoteAudio.autoplay = true;
          remoteAudio.hidden = true;
          document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = remoteStream;
        remoteAudio.play().catch(error => {
          console.error('Error playing remote audio:', error);
        });
      }
    };
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        if (pc.negotiating) return;
        pc.negotiating = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', { to: id, data: pc.localDescription });
        } catch (err) {
          console.error('Negotiation error:', err);
        } finally {
          pc.negotiating = false;
        }
      };
    }
    return pc;
  };

  const handleReturnToChat = () => {
    // Clean up local media
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }
    // Close all peer connections
    Object.values(peers.current).forEach(pc => {
      try { pc.close(); } catch (err) { /* ignore errors */ }
    });
    // Navigate back to the InterestChat room without reinitializing user search
    // Passing a flag 'rejoin' to indicate a return rather than a new join
    navigate('/interestchat', { state: { room: roomCode, username, rejoin: true } });
  };

  return (
    <div className="video-call-container">
      <div className="video-call-header">
        <div>
          <h2 className="video-call-title">
            Video Call: <span className="video-call-roomcode">{roomCode}</span>
          </h2>
          <p className="video-call-subtitle">
            {joined ? `Connected as ${username}` : roomCode ? 'Ready to join' : 'Invalid room - return to chat'}
          </p>
        </div>
        
        {!joined ? (
          roomCode ? (
            <button onClick={joinRoom} className="video-call-join-button">
              Join Video Call
            </button>
          ) : (
            <button 
              onClick={() => window.history.back()} 
              className="video-call-join-button"
              style={{ backgroundColor: '#4a69bd' }}
            >
              Return to Chat
            </button>
          )
        ) : (
          <div className="video-call-controls">
            <div className="video-call-participants">
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </div>
            <button 
              onClick={handleReturnToChat} 
              className="video-call-back-button"
            >
              Return to Chat
            </button>
          </div>
        )}
      </div>
      
      {!joined ? (
        <div className="video-call-welcome">
          <div className="video-call-welcome-icon">🎥</div>
          <h3>Ready to join the video call?</h3>
          <p className="video-call-welcome-text">
            Click the join button above to start your video call with others in this room.
          </p>
        </div>
      ) : (
        <div className="video-grid">
          <div className="video-container">
            <video 
              ref={localVideo} 
              muted 
              autoPlay 
              playsInline 
              className="video-element"
              style={{ transform: 'none' }} // Ensure no mirror effect
            />
            <div className="video-label">
              You (Local)
            </div>
          </div>

          {userIds.filter(id => id && id !== socket.id).map(id => (
            <RemoteVideo key={id} stream={remoteStreams[id]} peerId={id.slice(0,5)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper component to ensure remote video updates correctly
function RemoteVideo({ stream, peerId }) {
  const ref = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      
      // Check if the stream has video tracks
      setHasVideo(stream.getVideoTracks().length > 0 && 
                 stream.getVideoTracks()[0].enabled);
      
      // Listen for when tracks are added or removed
      const trackHandler = () => {
        const videoTracks = stream.getVideoTracks();
        setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      };
      
      stream.addEventListener('addtrack', trackHandler);
      stream.addEventListener('removetrack', trackHandler);
      
      // Audio level detection
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const audioSource = audioCtx.createMediaStreamSource(stream);
        audioSource.connect(analyser);
        analyser.fftSize = 32;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const checkAudio = () => {
          if (stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled) {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            setAudioLevel(average > 20 ? 1 : 0); // Simple threshold for speaking
          } else {
            setAudioLevel(0);
          }
          if (ref.current) {
            audioLevelRaf = requestAnimationFrame(checkAudio);
          }
        };
        
        let audioLevelRaf = requestAnimationFrame(checkAudio);
        
        return () => {
          stream.removeEventListener('addtrack', trackHandler);
          stream.removeEventListener('removetrack', trackHandler);
          cancelAnimationFrame(audioLevelRaf);
          audioSource.disconnect();
          audioCtx.close().catch(e => console.warn('Error closing audio context', e));
        };
      } catch (e) {
        console.warn('Audio visualization not supported', e);
        return () => {
          stream.removeEventListener('addtrack', trackHandler);
          stream.removeEventListener('removetrack', trackHandler);
        };
      }
    }
  }, [stream]);
  
  return (
    <div className={`video-container ${audioLevel ? 'speaking' : ''}`}>
      <video 
        ref={ref} 
        autoPlay 
        playsInline 
        className="video-element"
      />
      
      {!hasVideo && (
        <div className="video-avatar">
          👤
        </div>
      )}
      
      <div className={`video-label ${audioLevel ? 'speaking' : ''}`}>
        Peer-{peerId} {audioLevel ? '🔊' : ''}
      </div>
    </div>
  );
}

export default VideoCall;
