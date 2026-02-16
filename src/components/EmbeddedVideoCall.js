import React, { useEffect, useRef, useState } from 'react';
import socket from '../socket';
import '../InterestChat.css'; // Using InterestChat.css for shared styles

const iceServers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
];

function EmbeddedVideoCall({ roomCode, username, onClose }) {
    const [joined, setJoined] = useState(false);
    const [userIds, setUserIds] = useState([]);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const localVideo = useRef(null);
    const localStream = useRef(null);
    const peers = useRef({});
    const pendingCandidates = useRef({}); // Queue candidates for each peer

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

        socket.emit('join', { room: roomCode, username });
        setJoined(true);
        setUserIds([socket.id]);

        setupSocketListeners();

        try {
            const constraints = {
                audio: true,
                video: {
                    width: { ideal: 320, max: 480 },
                    height: { ideal: 240, max: 360 },
                    frameRate: { ideal: 15 }
                }
            };
            console.log('[Video] Requesting local media...');
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStream.current = stream;
            console.log('[Video] Local media obtained');

            if (localVideo.current) {
                localVideo.current.srcObject = stream;
                localVideo.current.muted = true;
            }

            // Sync tracks to any existing peers
            const tracks = stream.getTracks();
            Object.values(peers.current).forEach(pc => {
                const senders = pc.getSenders();
                tracks.forEach(track => {
                    const sender = senders.find(s => s.track && s.track.kind === track.kind);
                    if (sender) {
                        console.log(`[Video] Replacing track on existing PC`);
                        sender.replaceTrack(track);
                    } else {
                        console.log(`[Video] Adding track to existing PC`);
                        pc.addTrack(track, stream);
                    }
                });
            });

        } catch (e) {
            console.warn('[Video] Media access error:', e);
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
            newPeers.forEach(id => createPeerConnection(id, true));
        });

        socket.on('new-peer', ({ peerId, username }) => {
            console.log('[Video] New peer joined:', peerId);
            if (!peerId || peerId === socket.id) return;
            setUserIds(prev => prev.includes(peerId) ? prev : [...prev, peerId]);
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
                console.log(`[Video] Creating PC for signal from ${from}`);
                pc = createPeerConnection(from, false);
            }

            try {
                if (data.type === 'offer') {
                    console.log(`[Video] Handling offer from ${from}`);
                    await pc.setRemoteDescription(new window.RTCSessionDescription(data));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { to: from, data: pc.localDescription });
                    processPendingCandidates(from);
                } else if (data.type === 'answer') {
                    console.log(`[Video] Handling answer from ${from}`);
                    await pc.setRemoteDescription(new window.RTCSessionDescription(data));
                    processPendingCandidates(from);
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
                console.error('[Video] Signal error', err);
            }
        });
    };

    const processPendingCandidates = async (id) => {
        const candidates = pendingCandidates.current[id];
        if (candidates && peers.current[id]) {
            console.log(`[Video] Processing ${candidates.length} queued candidates for ${id}`);
            for (const candidate of candidates) {
                try {
                    await peers.current[id].addIceCandidate(new window.RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('[Video] Failed to add queued candidate', e);
                }
            }
            delete pendingCandidates.current[id];
        }
    };

    const createPeerConnection = (id, isInitiator) => {
        console.log(`[Video] Creating PC. Target: ${id}, Initiator: ${isInitiator}`);
        if (peers.current[id]) {
            peers.current[id].close();
        }

        const pc = new window.RTCPeerConnection({ iceServers });
        peers.current[id] = pc;

        pc.onicecandidate = e => {
            if (e.candidate) {
                socket.emit('signal', { to: id, data: e.candidate });
            }
        };

        pc.ontrack = e => {
            console.log(`[Video] Track event from ${id}. Stream count: ${e.streams.length}`);
            const remoteStream = e.streams[0];
            if (remoteStream) {
                setRemoteStreams(prev => ({ ...prev, [id]: remoteStream }));
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[Video] ICE state callback for ${id}: ${pc.iceConnectionState}`);
        };

        // Add local tracks immediately if available
        if (localStream.current) {
            console.log(`[Video] Adding local tracks to new PC for ${id}`);
            localStream.current.getTracks().forEach(track => {
                pc.addTrack(track, localStream.current);
            });
        }

        if (isInitiator) {
            pc.onnegotiationneeded = async () => {
                console.log(`[Video] Negotiation needed for ${id}`);
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('signal', { to: id, data: pc.localDescription });
                } catch (err) {
                    console.error('[Video] Offer error', err);
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

    return (
        <div className="embedded-video-container">
            <div className="embedded-header">
                <h4>Video Chat</h4>
                {onClose && (
                    <button onClick={onClose} className="embedded-close-btn">×</button>
                )}
            </div>

            {/* Local Video */}
            <div className="video-wrapper local">
                <video
                    ref={localVideo}
                    autoPlay
                    muted
                    playsInline
                    className="video-element local-mirror"
                />
                <div className="video-label">You</div>
            </div>

            {/* Remote Videos */}
            <div className="remote-videos-list">
                {userIds.filter(id => id && id !== socket.id).map(id => (
                    <EmbeddedRemoteVideo key={id} stream={remoteStreams[id]} peerId={id.slice(0, 4)} />
                ))}
                {userIds.length <= 1 && (
                    <div className="waiting-message">
                        Waiting for others...
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="embedded-controls">
                <button onClick={toggleMute} className={`control-btn ${isMuted ? 'active' : ''}`}>
                    {isMuted ? '🔇' : '🎤'}
                </button>
                <button onClick={toggleVideo} className={`control-btn ${isVideoOff ? 'active' : ''}`}>
                    {isVideoOff ? '📷' : '📹'}
                </button>
            </div>
        </div>
    );
}

function EmbeddedRemoteVideo({ stream, peerId }) {
    const ref = useRef(null);
    const [isMuted, setIsMuted] = useState(true); // Start muted to bypass autoplay block

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
            // Browsers allow muted video to autoplay without interaction
            ref.current.play().catch(e => {
                console.error(`[Video] Play failed for ${peerId}:`, e);
            });
        }
    }, [stream, peerId]);

    const handleUnmute = () => {
        if (ref.current) {
            ref.current.muted = false;
            setIsMuted(false);
        }
    };

    return (
        <div className="video-wrapper remote" onClick={handleUnmute}>
            <video
                ref={ref}
                autoPlay
                playsInline
                muted={isMuted}
                className="video-element"
            />
            {isMuted && (
                <div className="unmute-overlay">
                    <span>Tap to hear</span>
                </div>
            )}
            <div className="video-label">{peerId}</div>
        </div>
    );
}

export default EmbeddedVideoCall;
