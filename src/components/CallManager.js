import React, { useState, useRef, useEffect } from 'react';
import socket from '../socket';
import Swal from 'sweetalert2';

const CallManager = ({ roomCode, username, isVisible, onClose }) => {
  const [callState, setCallState] = useState('idle'); // idle, ringing, connecting, connected, ended
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [callParticipants, setCallParticipants] = useState([]);
  const [isCallInitiator, setIsCallInitiator] = useState(false);
  const [callInitiator, setCallInitiator] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [peerConnections, setPeerConnections] = useState(new Map());

  const localAudioRef = useRef(null);

  // WebRTC configuration with better ICE servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  useEffect(() => {
    if (isVisible) {
      // Get room participants when call manager opens
      socket.emit('getRoomParticipants', { roomCode });
    }
  }, [isVisible, roomCode]);

  useEffect(() => {
    // Socket event listeners
    socket.on('roomParticipants', handleRoomParticipants);
    socket.on('callRequest', handleIncomingCall);
    socket.on('callAccepted', handleCallAccepted);
    socket.on('callRejected', handleCallRejected);
    socket.on('callEnded', handleCallEnded);
    socket.on('userJoinedCall', handleUserJoinedCall);
    socket.on('userLeftCall', handleUserLeftCall);
    
    // WebRTC signaling events
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('iceCandidate', handleIceCandidate);

    return () => {
      socket.off('roomParticipants');
      socket.off('callRequest');
      socket.off('callAccepted');
      socket.off('callRejected');
      socket.off('callEnded');
      socket.off('userJoinedCall');
      socket.off('userLeftCall');
      socket.off('offer');
      socket.off('answer');
      socket.off('iceCandidate');
    };
  }, []);

  const handleRoomParticipants = ({ participants }) => {
    console.log('Room participants:', participants);
    setRoomParticipants(participants.filter(p => p !== username));
  };

  const handleIncomingCall = ({ from, roomCode: callRoomCode, participants, message }) => {
    console.log('Incoming call from:', from, 'room:', callRoomCode, 'participants:', participants);
    
    if (callRoomCode === roomCode) {
      setCallInitiator(from);
      setCallParticipants(participants || []);
      setCallState('ringing');
      
      // Teams-like notification
      Swal.fire({
        title: 'Incoming Call',
        text: message || `${from} is calling everyone in the room`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Join Call',
        cancelButtonText: 'Decline',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#dc3545',
        allowOutsideClick: false,
        allowEscapeKey: false,
        timer: 30000, // 30 second timeout
        timerProgressBar: true,
        showClass: {
          popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
          popup: 'animate__animated animate__fadeOutUp'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          console.log('Accepting call from:', from);
          acceptCall(from, participants);
        } else {
          console.log('Rejecting call from:', from);
          rejectCall(from);
        }
      });
    }
  };

  const handleCallAccepted = async ({ from, roomCode: callRoomCode, callParticipants: participants, callState }) => {
    if (callRoomCode === roomCode) {
      setCallState(callState || 'connected');
      setIsInCall(true);
      setCallParticipants(participants || []);
      
      // Add to call participants if not already there
      setCallParticipants(prev => {
        if (!prev.includes(from)) {
          return [...prev, from];
        }
        return prev;
      });
      
      // If we have a local stream, create peer connection with the new participant
      if (localStream && from !== username) {
        await createPeerConnection(from);
      }
      
      // Show notification
      Swal.fire({
        title: 'Call Connected',
        text: `${from} joined the call`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  };

  const handleCallRejected = ({ from, roomCode: callRoomCode }) => {
    if (callRoomCode === roomCode) {
      setCallState('idle');
      Swal.fire({
        title: 'Call Declined',
        text: `${from} declined the call`,
        icon: 'info',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  };

  const handleCallEnded = ({ from, roomCode: callRoomCode, message }) => {
    if (callRoomCode === roomCode) {
      endCall();
      Swal.fire({
        title: 'Call Ended',
        text: message || `${from} ended the call`,
        icon: 'info',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  };

  const handleUserJoinedCall = async ({ username: participantName, roomCode: callRoomCode, callParticipants: participants }) => {
    if (callRoomCode === roomCode) {
      setCallParticipants(participants || []);
      
      setCallParticipants(prev => {
        if (!prev.includes(participantName)) {
          return [...prev, participantName];
        }
        return prev;
      });
      
      // If we have a local stream, create peer connection with the new participant
      if (localStream && participantName !== username) {
        await createPeerConnection(participantName);
      }
      
      Swal.fire({
        title: 'User Joined',
        text: `${participantName} joined the call`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  };

  const handleUserLeftCall = ({ username: participantName, roomCode: callRoomCode, callParticipants: participants, callState }) => {
    if (callRoomCode === roomCode) {
      setCallParticipants(participants || []);
      setCallState(callState || 'idle');
      
      setCallParticipants(prev => prev.filter(p => p !== participantName));
      
      // Close peer connection with the participant who left
      if (peerConnections.has(participantName)) {
        peerConnections.get(participantName).close();
        setPeerConnections(prev => {
          const newMap = new Map(prev);
          newMap.delete(participantName);
          return newMap;
        });
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(participantName);
          return newMap;
        });
      }
      
      Swal.fire({
        title: 'User Left',
        text: `${participantName} left the call`,
        icon: 'info',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  };

  // WebRTC handlers
  const handleOffer = async ({ from, offer }) => {
    try {
      console.log('Handling offer from socket ID:', from);
      
      // Get username for the socket ID
      const response = await new Promise((resolve) => {
        socket.emit('getUsername', { socketId: from }, resolve);
      });
      
      if (!response.username) {
        console.error('Could not find username for socket ID:', from);
        return;
      }
      
      const peerConnection = await createPeerConnection(response.username);
      if (!peerConnection) return;
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      socket.emit('answer', { to: from, answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async ({ from, answer }) => {
    try {
      console.log('Handling answer from socket ID:', from);
      
      // Get username for the socket ID
      const response = await new Promise((resolve) => {
        socket.emit('getUsername', { socketId: from }, resolve);
      });
      
      if (!response.username) {
        console.error('Could not find username for socket ID:', from);
        return;
      }
      
      const peerConnection = peerConnections.get(response.username);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async ({ from, candidate }) => {
    try {
      console.log('Handling ICE candidate from socket ID:', from);
      
      // Get username for the socket ID
      const response = await new Promise((resolve) => {
        socket.emit('getUsername', { socketId: from }, resolve);
      });
      
      if (!response.username) {
        console.error('Could not find username for socket ID:', from);
        return;
      }
      
      const peerConnection = peerConnections.get(response.username);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const createPeerConnection = async (participantId) => {
    console.log('Creating peer connection for:', participantId);
    
    // Get socket ID for the participant
    const response = await new Promise((resolve) => {
      socket.emit('getSocketId', { username: participantId }, resolve);
    });
    
    if (!response.socketId) {
      console.error('Could not find socket ID for participant:', participantId);
      return null;
    }
    
    const peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', participantId);
        socket.emit('iceCandidate', {
          to: response.socketId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        console.log(`Successfully connected to ${participantId}`);
      } else if (peerConnection.connectionState === 'failed') {
        console.error(`Connection failed with ${participantId}`);
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${participantId}:`, peerConnection.iceConnectionState);
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', participantId);
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setRemoteStreams(prev => new Map(prev.set(participantId, remoteStream)));
        console.log(`Audio track added for ${participantId}:`, remoteStream.getAudioTracks().length);
      }
    };

    setPeerConnections(prev => new Map(prev.set(participantId, peerConnection)));
    
    // Create and send offer
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await peerConnection.setLocalDescription(offer);
      console.log('Sending offer to:', participantId);
      socket.emit('offer', { to: response.socketId, offer });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
    
    return peerConnection;
  };

  // Simple call functions (Teams-like)
  const startCall = async () => {
    try {
      console.log('Starting call in room:', roomCode);
      setCallState('connecting');
      setIsCallInitiator(true);
      
      // Show loading notification
      Swal.fire({
        title: 'Starting Call',
        text: 'Getting microphone access...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setLocalStream(stream);
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }
      
      // Close loading notification
      Swal.close();
      
      // Get all participants in the room
      const allParticipants = [username, ...roomParticipants];
      console.log('Starting call with participants:', allParticipants);
      
      // Notify all room participants about the call
      socket.emit('callRequest', { 
        roomCode, 
        from: username,
        participants: allParticipants,
        message: `${username} is calling everyone in the room`
      });
      
      setCallParticipants([username, ...roomParticipants]);
      setCallState('ringing');
      setIsInCall(true);
      
      // Show success notification
      Swal.fire({
        title: 'Call Started',
        text: `Notifying ${roomParticipants.length} participants in the room`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      
      console.log('Call started successfully');
      
    } catch (error) {
      console.error('Error starting call:', error);
      Swal.close();
      
      let errorMessage = 'Could not start call';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Calls are not supported in this browser.';
      } else {
        errorMessage = `Could not start call: ${error.message}`;
      }
      
      Swal.fire({
        title: 'Call Failed',
        text: errorMessage,
        icon: 'error',
        confirmButtonText: 'OK'
      });
      
      setCallState('idle');
      setIsInCall(false);
      setIsCallInitiator(false);
    }
  };

  const acceptCall = async (from, participants) => {
    try {
      console.log('Accepting call from:', from, 'participants:', participants);
      setCallState('connecting');
      
      // Show loading notification
      Swal.fire({
        title: 'Joining Call',
        text: 'Getting microphone access...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setLocalStream(stream);
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }
      
      // Close loading notification
      Swal.close();
      
      // Create peer connections with existing call participants
      for (const participant of participants) {
        if (participant !== username) {
          await createPeerConnection(participant);
        }
      }
      
      // Notify the backend that you accepted the call
      socket.emit('callAccepted', { from: username, roomCode });
      socket.emit('userJoinedCall', { username, roomCode });
      
      setCallState('connected');
      setIsInCall(true);
      setCallParticipants(participants || [from, username]);
      
      // Show success notification
      Swal.fire({
        title: 'Call Connected',
        text: `You joined the call with ${from}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      
      console.log('Call accepted successfully');
      
    } catch (error) {
      console.error('Error joining call:', error);
      Swal.close();
      
      let errorMessage = 'Could not join call';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Calls are not supported in this browser.';
      } else {
        errorMessage = `Could not join call: ${error.message}`;
      }
      
      Swal.fire({
        title: 'Join Call Failed',
        text: errorMessage,
        icon: 'error',
        confirmButtonText: 'OK'
      });
      
      setCallState('idle');
      setIsInCall(false);
    }
  };

  const rejectCall = (from) => {
    console.log('Rejecting call from:', from);
    socket.emit('callRejected', { from: username, roomCode });
    setCallState('idle');
    setCallInitiator(null);
    setCallParticipants([]);
    
    // Show notification
    Swal.fire({
      title: 'Call Declined',
      text: `You declined the call from ${from}`,
      icon: 'info',
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  const endCall = () => {
    console.log('Ending call');
    
    // Stop all local media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }
    
    // Close all peer connections
    peerConnections.forEach((connection, participantId) => {
      connection.close();
    });
    setPeerConnections(new Map());
    
    // Clear remote streams
    setRemoteStreams(new Map());
    
    // Notify backend
    socket.emit('callEnded', { roomCode, from: username });
    socket.emit('userLeftCall', { username, roomCode });
    
    // Reset state
    setCallState('idle');
    setIsInCall(false);
    setIsCallInitiator(false);
    setCallInitiator(null);
    setCallParticipants([]);
    setIsMuted(false);
    
    // Show notification
    Swal.fire({
      title: 'Call Ended',
      text: 'You ended the call',
      icon: 'info',
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
    
    console.log('Call ended successfully');
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  if (!isVisible) return null;

  // Show dedicated call screen when in call
  if (isInCall) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        {/* Call Header */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '15px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
            📞 Voice Call - Room: {roomCode}
          </div>
          <div style={{ color: '#4caf50', fontSize: '1rem' }}>
            {callParticipants.length} participant{callParticipants.length !== 1 ? 's' : ''} in call
          </div>
        </div>

        {/* Main Call Area */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          paddingTop: '80px'
        }}>
          {/* Call Status */}
          <div style={{
            textAlign: 'center',
            marginBottom: '40px',
            color: '#fff'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>
              {callState === 'connected' ? '✅ Call Connected' : '🔄 Connecting...'}
            </div>
            <div style={{ fontSize: '1.1rem', opacity: 0.8 }}>
              Voice chat is active
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '10px' }}>
              {remoteStreams.size > 0 ? 
                `🔊 ${remoteStreams.size} participant${remoteStreams.size !== 1 ? 's' : ''} connected` : 
                '🔄 Establishing voice connections...'
              }
            </div>
          </div>

          {/* Participants Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            maxWidth: '800px',
            width: '100%',
            marginBottom: '40px'
          }}>
            {callParticipants.map((participant, index) => (
              <div key={index} style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '15px',
                padding: '20px',
                textAlign: 'center',
                border: participant === username ? '2px solid #4caf50' : '2px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: participant === username ? '#4caf50' : '#2196f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  color: '#fff'
                }}>
                  {participant === username ? '🎤' : '👤'}
                </div>
                <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {participant} {participant === username ? '(You)' : ''}
                </div>
                <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
                  {participant === username ? 'Your microphone' : 'Participant'}
                </div>
                {remoteStreams.has(participant) && (
                  <div style={{ color: '#4caf50', fontSize: '0.8rem' }}>
                    🔊 Connected
                  </div>
                )}
                {participant === username && isMuted && (
                  <div style={{ color: '#ff9800', fontSize: '0.8rem' }}>
                    🔇 Muted
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Call Controls */}
          <div style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'center'
          }}>
            <button
              onClick={toggleMute}
              style={{
                background: isMuted ? '#dc3545' : 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                border: 'none',
                padding: '20px',
                borderRadius: '50%',
                fontSize: '2rem',
                cursor: 'pointer',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                boxShadow: isMuted ? '0 4px 20px rgba(220, 53, 69, 0.4)' : '0 4px 20px rgba(255, 255, 255, 0.1)'
              }}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>

            <button
              onClick={endCall}
              style={{
                background: '#dc3545',
                color: '#fff',
                border: 'none',
                padding: '20px',
                borderRadius: '50%',
                fontSize: '2rem',
                cursor: 'pointer',
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 20px rgba(220, 53, 69, 0.4)'
              }}
              title="End call"
            >
              📞
            </button>
          </div>

          {/* Call Tips */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '10px',
            padding: '15px',
            color: '#ccc',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            💡 Voice chat is active. Use the mute button to control your microphone. 
            {remoteStreams.size > 0 && ` ${remoteStreams.size} participant${remoteStreams.size !== 1 ? 's' : ''} connected.`}
          </div>
        </div>

        {/* Hidden audio elements for voice chat */}
        <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
        {Array.from(remoteStreams.keys()).map((participantId) => (
          <audio
            key={participantId}
            autoPlay
            style={{ display: 'none' }}
            ref={(el) => {
              if (el && remoteStreams.get(participantId)) {
                el.srcObject = remoteStreams.get(participantId);
                console.log(`Audio element set for ${participantId}`);
              }
            }}
            onLoadedMetadata={() => console.log(`Audio metadata loaded for ${participantId}`)}
            onCanPlay={() => console.log(`Audio can play for ${participantId}`)}
            onError={(e) => console.error(`Audio error for ${participantId}:`, e)}
          />
        ))}
      </div>
    );
  }

  // Regular call manager UI (when not in call)
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(0, 0, 0, 0.95)',
        borderRadius: '20px',
        padding: '30px',
        maxWidth: '600px',
        width: '100%',
        border: '2px solid rgba(0, 183, 235, 0.5)',
        boxShadow: '0 0 30px rgba(0, 183, 235, 0.3)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#00b7eb', margin: 0 }}>
            📞 Call Manager - Room: {roomCode}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '5px 10px',
              borderRadius: '5px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Call Status */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          padding: '15px',
          borderRadius: '10px',
          background: callState === 'connected' ? 'rgba(76, 175, 80, 0.2)' : 
                     callState === 'ringing' ? 'rgba(255, 152, 0, 0.2)' :
                     callState === 'connecting' ? 'rgba(33, 150, 243, 0.2)' :
                     'rgba(0, 183, 235, 0.1)',
          color: callState === 'connected' ? '#4caf50' : 
                 callState === 'ringing' ? '#ff9800' :
                 callState === 'connecting' ? '#2196f3' :
                 '#00b7eb',
          border: `2px solid ${callState === 'connected' ? '#4caf50' : 
                               callState === 'ringing' ? '#ff9800' :
                               callState === 'connecting' ? '#2196f3' :
                               '#00b7eb'}`
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px' }}>
            {callState === 'idle' && '📞 Ready to Call'}
            {callState === 'ringing' && '📞 Call Ringing...'}
            {callState === 'connecting' && '🔄 Connecting...'}
            {callState === 'connected' && '✅ Call Connected'}
          </div>
          {callState === 'connected' && callParticipants.length > 0 && (
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
              {callParticipants.length} participant{callParticipants.length !== 1 ? 's' : ''} in call
            </div>
          )}
        </div>

        {/* Call Participants (when in call) */}
        {isInCall && callParticipants.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#fff', marginBottom: '10px' }}>
              📞 Call Participants ({callParticipants.length})
            </h4>
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '10px',
              padding: '15px',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {callParticipants.map((participant, index) => (
                <div key={index} style={{ 
                  color: participant === username ? '#4caf50' : '#ccc', 
                  marginBottom: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>
                    {participant === username ? '🎤' : '👤'}
                  </span>
                  <span style={{ fontWeight: participant === username ? 'bold' : 'normal' }}>
                    {participant} {participant === username ? '(You)' : ''}
                  </span>
                  {remoteStreams.has(participant) && (
                    <span style={{ color: '#4caf50', fontSize: '0.8rem' }}>🔊</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Room Participants Section */}
        {!isInCall && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#fff', marginBottom: '10px' }}>
              👥 Room Participants ({roomParticipants.length + 1})
            </h4>
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '10px',
              padding: '15px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <div style={{ color: '#00b7eb', fontWeight: 'bold', marginBottom: '5px' }}>
                • {username} (You)
              </div>
              {roomParticipants.map((participant, index) => (
                <div key={index} style={{ color: '#ccc', marginBottom: '5px' }}>
                  • {participant}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden audio element for local stream */}
        <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />

        {/* Remote audio streams */}
        {Array.from(remoteStreams.keys()).map((participantId) => (
          <audio
            key={participantId}
            autoPlay
            style={{ display: 'none' }}
            ref={(el) => {
              if (el && remoteStreams.get(participantId)) {
                el.srcObject = remoteStreams.get(participantId);
                console.log(`Audio element set for ${participantId}`);
              }
            }}
            onLoadedMetadata={() => console.log(`Audio metadata loaded for ${participantId}`)}
            onCanPlay={() => console.log(`Audio can play for ${participantId}`)}
            onError={(e) => console.error(`Audio error for ${participantId}:`, e)}
          />
        ))}

        {/* Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '15px',
          flexWrap: 'wrap'
        }}>
          {!isInCall ? (
            <button
              onClick={startCall}
              disabled={roomParticipants.length === 0}
              style={{
                background: roomParticipants.length === 0 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'linear-gradient(45deg, #28a745, #20c997)',
                color: '#fff',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '25px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: roomParticipants.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: roomParticipants.length === 0 ? 0.5 : 1,
                boxShadow: roomParticipants.length === 0 ? 'none' : '0 4px 15px rgba(40, 167, 69, 0.3)',
                transition: 'all 0.3s ease'
              }}
              title={roomParticipants.length === 0 ? 'No other users in room' : 'Start call with all room participants'}
            >
              📞 Start Call
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                style={{
                  background: isMuted ? '#dc3545' : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  padding: '15px',
                  borderRadius: '50%',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: isMuted ? '0 4px 15px rgba(220, 53, 69, 0.3)' : '0 4px 15px rgba(255, 255, 255, 0.1)'
                }}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>

              <button
                onClick={endCall}
                style={{
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  padding: '15px',
                  borderRadius: '50%',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  width: '60px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(220, 53, 69, 0.3)'
                }}
                title="End call"
              >
                📞
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          fontSize: '0.9rem',
          color: '#ccc'
        }}>
          <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#00b7eb' }}>
            💡 Call Tips:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Click "Start Call" to invite all room participants</li>
            <li>Everyone in the room will receive a call notification</li>
            <li>Use the mute button to control your microphone</li>
            <li>Calls work best with headphones to avoid echo</li>
            <li>Make sure your microphone permissions are enabled</li>
            <li>🔊 indicates active voice connection</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CallManager; 