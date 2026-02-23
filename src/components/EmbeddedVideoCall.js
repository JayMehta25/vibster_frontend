import React, { useEffect, useRef, useState } from 'react';
import socket from '../socket';
import '../InterestChat.css';

// Multiple STUN servers + public TURN servers for cross-network/mobile support
const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    // Free public TURN servers (open-relay)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
];

function EmbeddedVideoCall({ roomCode, username, onClose }) {
    const [joined, setJoined] = useState(false);
    const [userIds, setUserIds] = useState([]);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [localReady, setLocalReady] = useState(false);
    const [error, setError] = useState(null);

    const localVideo = useRef(null);
    const localStream = useRef(null);
    const peers = useRef({});
    const pendingCandidates = useRef({});

    // Auto-join on mount
    useEffect(() => {
        if (roomCode) {
            joinRoom();
        }
        return () => {
            cleanup();
        };
    }, [roomCode]);

    const cleanup = () => {
        socket.off('peers');
        socket.off('new-peer');
        socket.off('peer-disconnected');
        socket.off('signal');

        Object.values(peers.current).forEach(pc => {
            if (pc && pc.close) pc.close();
        });
        peers.current = {};
        pendingCandidates.current = {};

        if (localStream.current) {
            localStream.current.getTracks().forEach(t => t.stop());
            localStream.current = null;
        }
    };

    const joinRoom = async () => {
        if (!roomCode) return;
        console.log(`[Video] Joining room: ${roomCode} as ${username}`);

        // Backend join handler in server.js supports both string and {room, username} object
        socket.emit('join', { room: roomCode, username: username || 'Anonymous' });
        setJoined(true);
        setUserIds([socket.id]);

        setupSocketListeners();

        try {
            // Try with video first, fall back to audio-only if device has no camera
            let stream;
            try {
                const constraints = {
                    audio: true,
                    video: {
                        width: { ideal: 320, max: 640 },
                        height: { ideal: 240, max: 480 },
                        frameRate: { ideal: 15, max: 30 }
                    }
                };
                console.log('[Video] Requesting video+audio...');
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (videoErr) {
                console.warn('[Video] Video failed, trying audio-only:', videoErr.message);
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                } catch (audioErr) {
                    console.error('[Video] Audio also failed:', audioErr.message);
                    setError('Camera/mic access denied. Please allow permissions.');
                    return;
                }
            }

            localStream.current = stream;
            console.log('[Video] Local media obtained. Tracks:', stream.getTracks().map(t => t.kind));

            if (localVideo.current) {
                localVideo.current.srcObject = stream;
                localVideo.current.muted = true;
            }
            setLocalReady(true);

            // Sync tracks to any existing peers that connected before media was ready
            Object.entries(peers.current).forEach(([id, pc]) => {
                const senders = pc.getSenders();
                stream.getTracks().forEach(track => {
                    const sender = senders.find(s => s.track && s.track.kind === track.kind);
                    if (sender) {
                        sender.replaceTrack(track);
                    } else {
                        pc.addTrack(track, stream);
                    }
                });
            });

        } catch (e) {
            console.warn('[Video] Media access error:', e);
            setError('Could not access camera/microphone: ' + e.message);
        }
    };

    const setupSocketListeners = () => {
        socket.off('peers');
        socket.off('new-peer');
        socket.off('peer-disconnected');
        socket.off('signal');

        socket.on('peers', ({ peers: peerIds }) => {
            console.log('[Video] Received peers list:', peerIds);
            const newPeers = peerIds.filter(id => id && id !== socket.id);
            setUserIds([socket.id, ...newPeers]);
            // We are the new joiner, so we initiate offers to all existing peers
            newPeers.forEach(id => createPeerConnection(id, true));
        });

        socket.on('new-peer', ({ peerId }) => {
            console.log('[Video] New peer joined:', peerId);
            if (!peerId || peerId === socket.id) return;
            setUserIds(prev => prev.includes(peerId) ? prev : [...prev, peerId]);
            // Existing peer, new user joined - don't initiate, wait for their offer
            createPeerConnection(peerId, false);
        });

        socket.on('peer-disconnected', (id) => {
            console.log('[Video] Peer disconnected:', id);
            if (!id) return;
            setUserIds(prev => prev.filter(uid => uid !== id));

            if (peers.current[id]) {
                peers.current[id].close();
                delete peers.current[id];
            }
            delete pendingCandidates.current[id];

            setRemoteStreams(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });
        });

        socket.on('signal', async ({ from, data }) => {
            console.log(`[Video] Signal from ${from}:`, data.type || (data.candidate ? 'candidate' : 'unknown'));
            if (!from || !data) return;

            let pc = peers.current[from];
            if (!pc) {
                console.log(`[Video] Creating PC for unexpected signal from ${from}`);
                pc = createPeerConnection(from, false);
            }

            try {
                if (data.type === 'offer') {
                    console.log(`[Video] Handling offer from ${from}`);
                    await pc.setRemoteDescription(new window.RTCSessionDescription(data));
                    await processPendingCandidates(from);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { to: from, data: pc.localDescription });
                } else if (data.type === 'answer') {
                    console.log(`[Video] Handling answer from ${from}`);
                    if (pc.signalingState === 'have-local-offer') {
                        await pc.setRemoteDescription(new window.RTCSessionDescription(data));
                        await processPendingCandidates(from);
                    }
                } else if (data.candidate) {
                    if (pc.remoteDescription && pc.remoteDescription.type) {
                        console.log(`[Video] Adding ICE candidate from ${from}`);
                        await pc.addIceCandidate(new window.RTCIceCandidate(data));
                    } else {
                        console.log(`[Video] Queuing ICE candidate from ${from}`);
                        if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
                        pendingCandidates.current[from].push(data);
                    }
                }
            } catch (err) {
                console.error('[Video] Signal handling error:', err.message);
            }
        });
    };

    const processPendingCandidates = async (id) => {
        const candidates = pendingCandidates.current[id];
        if (candidates && candidates.length > 0 && peers.current[id]) {
            console.log(`[Video] Processing ${candidates.length} queued candidates for ${id}`);
            for (const candidate of candidates) {
                try {
                    await peers.current[id].addIceCandidate(new window.RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('[Video] Failed to add queued candidate:', e.message);
                }
            }
            delete pendingCandidates.current[id];
        }
    };

    const createPeerConnection = (id, isInitiator) => {
        console.log(`[Video] Creating PC. Target: ${id}, Initiator: ${isInitiator}`);
        if (peers.current[id]) {
            console.log(`[Video] Closing existing PC for ${id}`);
            peers.current[id].close();
        }

        const pc = new window.RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
        peers.current[id] = pc;

        pc.onicecandidate = e => {
            if (e.candidate) {
                console.log(`[Video] Sending ICE candidate to ${id}`);
                socket.emit('signal', { to: id, data: e.candidate });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[Video] ICE state for ${id}: ${pc.iceConnectionState}`);
            // Attempt to restart ICE if it fails
            if (pc.iceConnectionState === 'failed') {
                console.log(`[Video] ICE failed for ${id}, attempting restart...`);
                pc.restartIce();
            }
        };

        pc.ontrack = e => {
            console.log(`[Video] Track received from ${id}. Streams: ${e.streams.length}, Track: ${e.track.kind}`);
            if (e.streams && e.streams[0]) {
                console.log(`[Video] Setting remote stream for ${id}`);
                setRemoteStreams(prev => ({ ...prev, [id]: e.streams[0] }));
            } else {
                // Fallback: create MediaStream from track
                console.log(`[Video] No stream in event, creating MediaStream from track`);
                setRemoteStreams(prev => {
                    const existingStream = prev[id];
                    if (existingStream) {
                        existingStream.addTrack(e.track);
                        return { ...prev, [id]: existingStream };
                    } else {
                        const newStream = new MediaStream([e.track]);
                        return { ...prev, [id]: newStream };
                    }
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[Video] Connection state for ${id}: ${pc.connectionState}`);
        };

        // Add local tracks if stream is already available
        if (localStream.current) {
            console.log(`[Video] Adding ${localStream.current.getTracks().length} local tracks to PC for ${id}`);
            localStream.current.getTracks().forEach(track => {
                pc.addTrack(track, localStream.current);
            });
        }

        if (isInitiator) {
            // Use onnegotiationneeded to create offer after tracks are added
            pc.onnegotiationneeded = async () => {
                console.log(`[Video] Negotiation needed for ${id}`);
                try {
                    // Avoid offer collisions
                    if (pc.signalingState !== 'stable') {
                        console.log(`[Video] Skipping offer, state: ${pc.signalingState}`);
                        return;
                    }
                    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                    await pc.setLocalDescription(offer);
                    socket.emit('signal', { to: id, data: pc.localDescription });
                    console.log(`[Video] Offer sent to ${id}`);
                } catch (err) {
                    console.error('[Video] Offer error:', err.message);
                }
            };
        }

        return pc;
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

    const toggleVideo = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    const remoteUserIds = userIds.filter(id => id && id !== socket.id);

    return (
        <div className="embedded-video-container">
            <div className="embedded-header">
                <h4>📹 Video Chat {remoteUserIds.length > 0 ? `(${remoteUserIds.length + 1} people)` : ''}</h4>
                {onClose && (
                    <button onClick={onClose} className="embedded-close-btn">×</button>
                )}
            </div>

            {error && (
                <div style={{
                    background: 'rgba(220, 53, 69, 0.15)',
                    border: '1px solid rgba(220, 53, 69, 0.4)',
                    color: '#ff6b6b',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    margin: '8px',
                    textAlign: 'center'
                }}>
                    ⚠️ {error}
                </div>
            )}

            <div className="all-videos-grid">
                {/* Local Video */}
                <div className="video-wrapper local">
                    <video
                        ref={localVideo}
                        autoPlay
                        muted
                        playsInline
                        className="video-element local-mirror"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#111' }}
                    />
                    <div className="video-label">You {isVideoOff ? '(Camera Off)' : ''}</div>
                    {!localReady && !error && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: 'rgba(0,0,0,0.7)', color: '#00b7ff',
                            fontSize: 13, flexDirection: 'column', gap: 8
                        }}>
                            <div style={{ width: 28, height: 28, border: '3px solid #00b7ff44', borderTop: '3px solid #00b7ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            Starting camera...
                        </div>
                    )}
                </div>

                {/* Remote Videos */}
                {remoteUserIds.map(id => (
                    <EmbeddedRemoteVideo key={id} stream={remoteStreams[id]} peerId={id.slice(0, 6)} />
                ))}

                {remoteUserIds.length === 0 && (
                    <div className="waiting-message">
                        <span>👋</span>
                        <span>Waiting for others to join video...</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="embedded-controls">
                <button onClick={toggleMute} className={`control-btn ${isMuted ? 'active' : ''}`} title={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted ? '🔇' : '🎤'}
                </button>
                <button onClick={toggleVideo} className={`control-btn ${isVideoOff ? 'active' : ''}`} title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
                    {isVideoOff ? '🚫📷' : '📹'}
                </button>
            </div>
        </div>
    );
}

function EmbeddedRemoteVideo({ stream, peerId }) {
    const ref = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [hasVideo, setHasVideo] = useState(true);

    useEffect(() => {
        if (ref.current && stream) {
            console.log(`[RemoteVideo] Attaching stream for ${peerId}. Tracks: ${stream.getTracks().map(t => t.kind).join(', ')}`);
            ref.current.srcObject = stream;

            // Check if stream has video track
            const videoTracks = stream.getVideoTracks();
            setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);

            // Unmuted autoplay - modern browsers allow this after user interaction
            ref.current.muted = false;
            ref.current.play()
                .then(() => {
                    console.log(`[RemoteVideo] Playing for ${peerId}`);
                    setPlaying(true);
                })
                .catch(e => {
                    console.warn(`[RemoteVideo] Autoplay failed for ${peerId}, trying muted:`, e.message);
                    // Fallback: muted autoplay (browser policy)
                    if (ref.current) {
                        ref.current.muted = true;
                        ref.current.play()
                            .then(() => setPlaying(true))
                            .catch(err => console.error(`[RemoteVideo] Even muted play failed:`, err.message));
                    }
                });
        }
    }, [stream, peerId]);

    // Listen for track changes
    useEffect(() => {
        if (!stream) return;
        const handleTrack = () => {
            const videoTracks = stream.getVideoTracks();
            setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
        };
        stream.addEventListener('addtrack', handleTrack);
        stream.addEventListener('removetrack', handleTrack);
        return () => {
            stream.removeEventListener('addtrack', handleTrack);
            stream.removeEventListener('removetrack', handleTrack);
        };
    }, [stream]);

    const handleClick = () => {
        if (ref.current) {
            ref.current.muted = false;
            ref.current.play().catch(() => { });
        }
    };

    return (
        <div className="video-wrapper remote" onClick={handleClick} style={{ cursor: 'pointer', position: 'relative' }}>
            {stream ? (
                <>
                    <video
                        ref={ref}
                        autoPlay
                        playsInline
                        className="video-element"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#111' }}
                    />
                    {!hasVideo && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: '#1a1a2e', flexDirection: 'column', gap: 8
                        }}>
                            <span style={{ fontSize: 40 }}>👤</span>
                            <span style={{ color: '#00b7ff', fontSize: 13 }}>Camera Off</span>
                        </div>
                    )}
                </>
            ) : (
                <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: '#0d1117', flexDirection: 'column', gap: 8
                }}>
                    <div style={{ width: 28, height: 28, border: '3px solid #00b7ff44', borderTop: '3px solid #00b7ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: '#00b7ff', fontSize: 12 }}>Connecting...</span>
                </div>
            )}
            <div className="video-label">{peerId}</div>
        </div>
    );
}

export default EmbeddedVideoCall;
