import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import socket from "./socket"; // using the shared socket
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from 'sweetalert2';
import Beams from './components/Beams';
import CallManager from './components/CallManager';
import VoiceCall from './components/VoiceCall';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// ...rest of your code...
// Add glitch animation styles
const glitchStyles = `
  @keyframes glitch {
    0% { background-position: 0 0; }
    20% { background-position: -10px 5px; }
    40% { background-position: 10px -5px; }
    60% { background-position: -10px 5px; }
    80% { background-position: 10px -5px; }
    100% { background-position: 0 0; }
  }
`;

// Simple helper to check if a URL is likely a video
// (works if the URL ends in .mp4, .mov, .webm, etc.)
function isVideoFile(url = "") {
  return /\.(mp4|mov|avi|webm)$/i.test(url);
}



// Add MIME type detection helper
const getMediaTypeFromMime = (mimeType = "") => {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return "file";
};

// Generate unique bubble color for each user based on username
const getUserBubbleColor = (username) => {
  // Create a hash from the username to ensure consistent colors
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use the hash to generate consistent, vibrant colors
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 90) % 360; // Increased hue shift for more contrast

  // Create gradient with wider saturation and lightness for more variety
  const sat1 = 50 + (Math.abs(hash) % 50); // Range: 50-100%
  const light1 = 40 + (Math.abs(hash) % 30); // Range: 40-70%
  const sat2 = 60 + (Math.abs(hash) % 40); // Range: 60-100%
  const light2 = 50 + (Math.abs(hash) % 25); // Range: 50-75%

  return `linear-gradient(135deg, hsl(${hue1}, ${sat1}%, ${light1}%) 0%, hsl(${hue2}, ${sat2}%, ${light2}%) 100%)`;
};

// Generate unique glow color for each user
const getUserGlowColor = (username) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const hue = Math.abs(hash) % 360;
  const sat = 80 + (Math.abs(hash) % 20); // 80-100%
  const light = 60 + (Math.abs(hash) % 20); // 60-80%

  return `hsla(${hue}, ${sat}%, ${light}%, 0.3)`;
};

// Determine if text should be dark or light based on background brightness
const getTextColor = (username) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Use the hash to determine if background is light or dark
  const lightness = 40 + (Math.abs(hash) % 20); // 40-60%
  return lightness > 50 ? "#000" : "#fff";
};

// Move these to the top level, above getPlayableAudioUrl:
const constructImageUrl = (imageUrl, filename) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;

  const API_URL = 'https://df11-183-87-251-162.ngrok-free.app';
  if (imageUrl.startsWith('/')) {
    // Use mobile-friendly image endpoint
    return `${API_URL}/image/${filename || imageUrl.split('/').pop()}`;
  }
  return imageUrl;
};

const constructAudioUrl = (audioObj) => {
  if (!audioObj) return null;
  let url = audioObj.url || audioObj.preview;
  if (!url) return null;
  // If it's a local blob, return as is
  if (audioObj.isLocal) {
    return url;
  }
  // Ensure URL is absolute
  const API_URL = 'https://df11-183-87-251-162.ngrok-free.app';
  if (url.startsWith('/')) {
    url = `${API_URL}${url}`;
  }
  // For iOS devices, try alternative endpoint if needed
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && url.includes('/uploads/')) {
    const filename = url.split('/').pop();
    const iosUrl = `${API_URL}/audio/${filename}`;
    console.log('iOS detected, trying alternative URL:', iosUrl);
    return iosUrl;
  }
  return url;
};

const tryAlternativeAudioUrl = async (originalUrl) => {
  if (!originalUrl) return null;
  const API_URL = 'https://df11-183-87-251-162.ngrok-free.app';
  const alternatives = [];
  // Extract filename from URL
  const filename = originalUrl.split('/').pop();
  if (filename) {
    // Try different endpoints
    alternatives.push(`${API_URL}/audio/${filename}`);
    alternatives.push(`${API_URL}/test-audio/${filename}`);
    alternatives.push(`${API_URL}/uploads/${filename}`);
  }
  // Test each alternative
  for (const altUrl of alternatives) {
    if (altUrl === originalUrl) continue; // Skip if it's the same as original
    try {
      const response = await fetch(altUrl, { method: 'HEAD' });
      if (response.ok) {
        return altUrl;
      }
    } catch (e) { }
  }
  return null; // No working alternative found
};

// Move these to the top level, outside of ChatMain:
const getPlayableAudioUrl = async (audioObj) => {
  let url = constructAudioUrl(audioObj);
  if (!url) return null;
  // On iOS, try alternative endpoint automatically
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && url.includes('/uploads/')) {
    const altUrl = await tryAlternativeAudioUrl(url);
    if (altUrl) return altUrl;
  }
  return url;
};

const SimpleAudioPlayer = ({ src }) => {
  const [error, setError] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const audioRef = React.useRef(null);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setError(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = (e) => {
      console.error('Audio error:', e);
      setError(true);
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // For mobile devices, ensure we have user interaction
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Playback failed:', error);
          setError(true);
        });
      }
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * duration;
    audio.currentTime = seekTime;
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: 340,
      minWidth: 200,
      background: '#f8f9fa',
      borderRadius: 12,
      border: '1px solid #e9ecef',
      padding: '12px 16px',
      margin: '4px 0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
    }}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        style={{ display: 'none' }}
      />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 8,
        width: '100%',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 16, marginRight: 6, color: '#007bff' }} role="img" aria-label="voice">🎤</span>
          <span style={{ fontWeight: 500, color: '#495057', fontSize: 14 }}>Voice Message</span>
        </div>
        {isLoading && (
          <div style={{ fontSize: 12, color: '#6c757d' }}>Loading...</div>
        )}
      </div>

      {/* Main player controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        gap: 12
      }}>
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            background: isPlaying ? '#dc3545' : '#007bff',
            color: 'white',
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            minWidth: 40,
            minHeight: 40,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>

        {/* Progress bar and time */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Progress bar */}
          <div
            onClick={handleSeek}
            style={{
              width: '100%',
              height: 6,
              background: '#e9ecef',
              borderRadius: 3,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${(currentTime / duration) * 100}%`,
                height: '100%',
                background: '#007bff',
                borderRadius: 3,
                transition: 'width 0.1s ease'
              }}
            />
          </div>

          {/* Time display */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#6c757d'
          }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: 6,
          color: '#721c24',
          fontSize: 12,
          textAlign: 'center',
          width: '100%'
        }}>
          <div style={{ marginBottom: 4 }}>
            Unable to play audio on this device.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <a
              href={src}
              download
              style={{
                color: '#007bff',
                textDecoration: 'underline',
                fontSize: 11
              }}
            >
              Download Audio
            </a>
            {isMobile && (
              <button
                onClick={() => window.open(src, '_blank')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#007bff',
                  textDecoration: 'underline',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                Open in New Tab
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile-specific fallback */}
      {isMobile && !error && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: '#6c757d',
          textAlign: 'center'
        }}>
          Tap play button to start audio
        </div>
      )}
    </div>
  );
};

function ChatMain() {
  const API_URL = 'https://df11-183-87-251-162.ngrok-free.app'; // backend ngrok URL



  // Helper function to validate audio URL and format
  const validateAudioUrl = async (audioUrl) => {
    try {
      const response = await fetch(audioUrl, { method: 'HEAD' });
      if (!response.ok) {
        return false;
      }

      const contentType = response.headers.get('content-type');
      console.log('Audio content type:', contentType);

      // Check if content type is audio
      if (contentType && contentType.startsWith('audio/')) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error validating audio URL:', error);
      return false;
    }
  };

  // Test audio file function
  const testAudioFile = async (filename) => {
    try {
      const response = await fetch(`${API_URL}/test-audio/${filename}`);
      console.log('Test audio response:', response.status, response.statusText);
      if (response.ok) {
        console.log('Audio file is accessible via test endpoint');
        return true;
      } else {
        console.error('Audio file test failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Audio file test error:', error);
      return false;
    }
  };

  // Comprehensive audio testing function
  const testAudioUrl = async (audioUrl) => {
    if (!audioUrl) return { success: false, error: 'No URL provided' };

    console.log('Testing audio URL:', audioUrl);

    try {
      // Test direct access
      const response = await fetch(audioUrl, { method: 'HEAD' });
      console.log('Direct access response:', response.status, response.statusText);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');

        console.log('Content-Type:', contentType);
        console.log('Content-Length:', contentLength);

        return {
          success: true,
          status: response.status,
          contentType,
          contentLength,
          url: audioUrl
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          url: audioUrl
        };
      }
    } catch (error) {
      console.error('Audio URL test error:', error);
      return {
        success: false,
        error: error.message,
        url: audioUrl
      };
    }
  };

  const location = useLocation();
  const navigate = useNavigate();
  const { username: navUsername, roomCode, isMaster, bubbleColor } = location.state || {};
  const username = navUsername || localStorage.getItem('username') || '';

  useEffect(() => {
    if (!username || !roomCode) {
      navigate("/");
    }

    // Register the socket ID with the username
    socket.emit("register", username);

    // Join the room directly
    console.log("Attempting to join room:", roomCode, "as user:", username);
    socket.emit("joinRoom", { roomCode, username });

    // Socket listeners
    const messageHandler = (msg) => {
      console.log("Received message:", msg);
      setMessages(prev => {
        // Check if message with this ID already exists
        const existingMessageIndex = prev.findIndex(m => m.id === msg.id);

        if (existingMessageIndex > -1) {
          // If message exists, update it (e.g., mark as not sending)
          console.log("Updating existing message:", msg.id);
          return prev.map((m, index) =>
            index === existingMessageIndex ? { ...msg, isSending: false, likes: msg.likes || [] } : m
          );
        } else {
          // If message is new, add it
          console.log("Adding new message:", msg.id);
          return [...prev, { ...msg, likes: msg.likes || [] }];
        }
      });
    };

    const roomHistoryHandler = ({ messages }) => {
      console.log("Received room history:", messages);
      // Replace existing messages with history, ensuring 'likes' is present
      setMessages(messages.map(msg => ({ ...msg, likes: msg.likes || [] })));
    };

    const userJoinedHandler = ({ username: joinedUsername, users }) => {
      console.log(`${joinedUsername} joined the room`);
      if (users && Array.isArray(users)) {
        setUserCount(users.length);
        console.log("Updated user count:", users.length);
      }
    };

    const userLeftHandler = ({ username: leftUsername, users }) => {
      console.log(`${leftUsername} left the room`);
      if (users && Array.isArray(users)) {
        setUserCount(users.length);
        console.log("Updated user count:", users.length);
      }
    };

    const roomUsersHandler = ({ users }) => {
      console.log("Received room users update:", users);
      if (users && Array.isArray(users)) {
        setUserCount(users.length);
        console.log("Updated user count:", users.length);
      }
    };

    socket.on("receiveMessage", messageHandler);
    socket.on("roomHistory", roomHistoryHandler);
    socket.on("userJoined", userJoinedHandler);
    socket.on("userLeft", userLeftHandler);
    socket.on("roomUsers", roomUsersHandler);

    // Add logging for socket connection status
    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Listen for edited messages
    socket.on('messageEdited', (editedMessage) => {
      console.log('Message edited:', editedMessage);
      setMessages(prev => prev.map(msg =>
        msg.id === editedMessage.id ? { ...msg, ...editedMessage, isEdited: true } : msg
      ));
    });

    // Listen for deleted messages
    socket.on('messageDeleted', ({ messageId, username }) => {
      console.log('Message deleted:', messageId, 'by:', username);
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, isDeleted: true, deletedBy: username } : msg
      ));
    });

    return () => {
      socket.off("receiveMessage", messageHandler);
      socket.off("roomHistory", roomHistoryHandler);
      socket.off("userJoined", userJoinedHandler);
      socket.off("userLeft", userLeftHandler);
      socket.off("roomUsers", roomUsersHandler);
      // Clean up connection listeners too
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off('messageEdited');
      socket.off('messageDeleted');
    };
  }, [username, roomCode, navigate]);

  const [backgroundImage, setBackgroundImage] = useState(null);
  const [previewBackground, setPreviewBackground] = useState(null);
  const [generatedRoom] = useState(roomCode || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [attachment, setAttachment] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendAnimating, setSendAnimating] = useState(false);

  // Refs initialization
  const audioRecorder = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null); // Create a ref for the end of the messages

  // Add this state for tracking deleted messages
  const [deletedMessages, setDeletedMessages] = useState(new Set());

  // Add these state variables at the top with other state declarations
  const [showActions, setShowActions] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [shouldScrollOnSend, setShouldScrollOnSend] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  const [showVoiceCall, setShowVoiceCall] = useState(false);

  // Double tap handler for likes
  const handleDoubleTap = (index) => {
    const updatedMessages = [...messages];
    if (!updatedMessages[index].likes) updatedMessages[index].likes = [];
    if (!updatedMessages[index].likes.includes(username)) {
      updatedMessages[index].likes.push(username);
      setMessages(updatedMessages);
      socket.emit("likeMessage", {
        roomCode,
        messageId: updatedMessages[index].id
      });
    }
  };

  // Simple audio validation effect
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.audio) {
        // Get the audio URL and make it absolute if needed
        let audioUrl = msg.audio.url || msg.audio.preview;
        if (msg.audio && !msg.audio.isLocal && audioUrl && audioUrl.startsWith('/')) {
          audioUrl = `${API_URL}${audioUrl}`;
        }
        console.log("Audio message URL:", audioUrl);
      }
    });
  }, [messages]);

  // Simple local audio preview
  useEffect(() => {
    if (recordedAudio) {
      console.log('Local audio recorded:', recordedAudio.size, 'bytes, type:', recordedAudio.type);
    }
  }, [recordedAudio]);

  // Start recording audio - NEW SIMPLIFIED APPROACH
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 22050, // Lower sample rate for better compatibility
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Use a simple, widely supported format
      let mimeType = 'audio/webm';

      // Test for basic WebM support first
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        // Fallback to basic audio recording without specific codec
        mimeType = '';
        console.log('WebM not supported, using basic audio recording');
      }

      console.log('Using MIME type for recording:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        try {
          // Create blob with detected type or default to webm
          const blobType = audioChunks.length > 0 ? audioChunks[0].type : 'audio/webm';
          const audioBlob = new Blob(audioChunks, { type: blobType });
          console.log('Recording completed, blob size:', audioBlob.size, 'type:', audioBlob.type);

          // Validate the blob before setting it
          if (audioBlob.size > 0) {
            setRecordedAudio(audioBlob);
          } else {
            console.error('Recording failed: empty blob');
            alert('Recording failed. Please try again.');
          }
        } catch (error) {
          console.error('Error creating audio blob:', error);
          alert('Recording failed. Please try again.');
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        alert('Recording error occurred. Please try again.');
      };

      mediaRecorder.start(1000); // Collect data every second
      audioRecorder.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);

      // More specific error messages
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotSupportedError') {
        alert('Audio recording is not supported in this browser. Please try a different browser.');
      } else {
        alert('Could not start recording: ' + error.message);
      }
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    if (audioRecorder.current?.state === "recording") {
      audioRecorder.current.stop();
      setIsRecording(false);

      // Add logging for the recorded audio Blob
      if (recordedAudio) {
        console.log("Recorded Audio Blob:", recordedAudio);
        console.log("Recorded Audio Type:", recordedAudio.type);
        console.log("Recorded Audio Size:", recordedAudio.size, "bytes");
      } else {
        console.warn("Recorded audio Blob is null or undefined after stopping.");
      }
    }
  };

  // Modified uploadFile function with MIME type preservation
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    setIsSending(true);
    isSendingRef.current = true;

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload response:', errorText);
        throw new Error(errorText || "Upload failed");
      }

      const data = await response.json();
      console.log('Upload successful:', data);

      // Construct the absolute URL for the attachment
      const absoluteUrl = new URL(data.url, API_URL).href;

      return {
        url: absoluteUrl,
        type: getMediaTypeFromMime(data.mimetype),
        name: file.name,
        mime: data.mimetype
      };
    } catch (err) {
      console.error("Upload error details:", err);
      throw err;
    }
  };

  // Enhanced message sending handler
  const handleSendMessage = async () => {
    if (!input.trim() && !attachment && !recordedAudio) return;

    setSendAnimating(true);
    setTimeout(() => setSendAnimating(false), 700);

    if (isSendingRef.current) return;

    isSendingRef.current = true;
    setIsSending(true);

    const tempId = Date.now();
    // Show a temporary sending message for any content (text, attachment, or audio)
    if (input.trim() || attachment || recordedAudio) {
      setMessages(prev => [...prev, {
        id: tempId,
        roomCode,
        username,
        message: input.trim() || '',
        attachment: attachment ? {
          url: URL.createObjectURL(attachment),
          type: getMediaTypeFromMime(attachment.type),
          name: attachment.name,
          mime: attachment.type,
          isLocal: true
        } : null,
        audio: recordedAudio ? {
          url: URL.createObjectURL(recordedAudio),
          mime: recordedAudio.type,
          isLocal: true
        } : null,
        timestamp: new Date().toLocaleTimeString(),
        likes: [],
        isSending: true,
        bubbleColor: bubbleColor
      }]);
    }

    try {
      const uploads = [];
      let attachmentResult = null;
      let audioResult = null;

      if (attachment) {
        uploads.push(uploadFile(attachment).then(result => {
          attachmentResult = result;
        }));
      }
      if (recordedAudio instanceof Blob) {
        uploads.push(uploadFile(recordedAudio).then(result => {
          audioResult = result;
        }));
      }
      await Promise.all(uploads);

      // Build the final message with backend URLs
      const finalMsg = {
        id: tempId,
        roomCode,
        username,
        message: input.trim(),
        bubbleColor: bubbleColor,
        attachment: attachmentResult
          ? {
            url: attachmentResult.url,
            type: attachmentResult.type,
            name: attachmentResult.name,
            mime: attachmentResult.mime
          }
          : null,
        audio: audioResult
          ? {
            url: audioResult.url,
            mime: audioResult.mime
          }
          : null,
        timestamp: new Date().toLocaleTimeString(),
        likes: [],
        isSending: false
      };

      // Remove any previous temp message with this id and replace with backend URL version (for all, including sender)
      setMessages(prev => prev.filter(msg => msg.id !== tempId).concat(finalMsg));
      socket.emit("sendMessage", finalMsg);
    } catch (err) {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      console.error("Message send error:", err);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
      setInput("");
      setAttachment(null);
      setRecordedAudio(null);
      setShouldScrollOnSend(true);
    }
  };

  // Handle background image selection
  const handleBackgroundSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewBackground(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmBackground = () => {
    // Emit background change to all users in the room first
    socket.emit("changeBackground", {
      roomCode,
      backgroundImage: previewBackground
    });
    // Then update local state
    setBackgroundImage(previewBackground);
    setPreviewBackground(null);
  };

  // Add background change listener
  useEffect(() => {
    // Listen for background changes from other users
    socket.on("backgroundChanged", ({ backgroundImage }) => {
      console.log("Received background change:", backgroundImage);
      setBackgroundImage(backgroundImage);
      setPreviewBackground(null);
    });

    // Listen for initial room background when joining
    socket.on("roomBackground", ({ backgroundImage }) => {
      console.log("Received initial room background:", backgroundImage);
      if (backgroundImage) {
        setBackgroundImage(backgroundImage);
      }
    });

    return () => {
      socket.off("backgroundChanged");
      socket.off("roomBackground");
    };
  }, []);

  const cancelPreview = () => {
    setPreviewBackground(null);
  };

  const createRoom = () => {
    if (username.trim()) {
      console.log("Creating room for username:", username);
      socket.emit("createRoom", username, (response) => {
        // Handle response...
      });
    } else {
      console.error("Username is required to create a room");
    }
  };

  // Update joinRoom to handle non-existent room codes
  const joinRoom = () => {
    if (roomCode.trim() && username.trim()) {
      console.log("Joining room:", roomCode, "for user:", username);
      socket.emit("joinRoom", { roomCode, username }, (response) => {
        // Handle response from server
        if (response && response.success === false) {
          // Show error if room does not exist
          alert(response.message || 'Room code does not exist.');
        } else {
          // Optionally handle success (do nothing, already handled by socket events)
        }
      });
    } else {
      console.error("Room code and username are required to join a room");
    }
  };

  // Scroll to the bottom of the messages when a new message is received
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]); // This effect runs whenever messages change

  // Add edit message handler
  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditContent(message.message);
  };

  // Add save edit handler
  const handleSaveEdit = () => {
    if (editingMessage && editContent.trim()) {
      const updatedMessage = {
        ...editingMessage,
        message: editContent.trim(),
        isEdited: true
      };

      socket.emit('editMessage', {
        roomCode,
        messageId: editingMessage.id,
        newContent: editContent.trim()
      });

      // Update local state immediately
      setMessages(prev => prev.map(msg =>
        msg.id === editingMessage.id ? updatedMessage : msg
      ));

      setEditingMessage(null);
      setEditContent('');
    }
  };

  // Add delete message handler
  const handleDeleteMessage = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      socket.emit('deleteMessage', {
        roomCode,
        messageId
      });
      // Hide actions after deletion
      setShowActions(null);
    }
  };

  // Add cancel edit handler
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  // Update the handleMessagePress function
  const handleMessagePress = (messageId, event) => {
    // Only prevent default for mouse events
    if (event.type === 'mousedown') {
      event.preventDefault();
    }

    // Start long press timer
    const timer = setTimeout(() => {
      setShowActions(messageId);
    }, 500); // 500ms for long press
    setLongPressTimer(timer);
  };

  // Update the handleMessageRelease function
  const handleMessageRelease = (event) => {
    // Only prevent default for mouse events
    if (event.type === 'mouseup') {
      event.preventDefault();
    }

    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Update the handleMessageDoubleClick function
  const handleMessageDoubleClick = (messageId, event) => {
    event.preventDefault();

    setShowActions(messageId);
  };

  // Add a new function to handle touch events
  const handleTouchStart = (messageId, event) => {
    // Start long press timer
    const timer = setTimeout(() => {
      setShowActions(messageId);
    }, 500); // 500ms for long press
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Emit typing event on input change
  const handleInputChange = (e) => {
    setInput(e.target.value);
    socket.emit('typing', { room: roomCode, username, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { room: roomCode, username, isTyping: false });
    }, 1500); // 1.5s after last keystroke
  };

  // Emit typing event on blur
  const handleInputBlur = () => {
    socket.emit('typing', { room: roomCode, username, isTyping: false });
  };

  // Listen for userTyping events
  useEffect(() => {
    const handleUserTyping = ({ username: typingUser, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          if (!prev.includes(typingUser) && typingUser !== username) {
            return [...prev, typingUser];
          }
          return prev;
        } else {
          return prev.filter(u => u !== typingUser);
        }
      });
    };
    socket.on('userTyping', handleUserTyping);
    return () => socket.off('userTyping', handleUserTyping);
  }, [username]);

  // Listen for incoming calls
  useEffect(() => {
    const handleIncomingCall = ({ from, roomCode: callRoomCode, participants, message }) => {
      if (callRoomCode === roomCode && from !== username) {
        Swal.fire({
          title: 'Incoming Call! 🎉',
          text: message || `${from} is inviting you to a group voice call!`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Join Call',
          cancelButtonText: 'Decline',
          confirmButtonColor: '#28a745',
          cancelButtonColor: '#dc3545',
          allowOutsideClick: false,
          allowEscapeKey: false,
          background: '#fffde7',
          color: '#6d4c41',
          showClass: { popup: 'animate__animated animate__tada' },
          hideClass: { popup: 'animate__animated animate__fadeOut' }
        }).then((result) => {
          if (result.isConfirmed) {
            navigate('/voicecall', { state: { roomCode, username } });
          } else {
            Swal.fire({
              title: 'Call Declined',
              text: 'You stayed in the chat.',
              icon: 'info',
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end',
              background: '#fff3e0',
              color: '#bf360c',
              showClass: { popup: 'animate__animated animate__fadeIn' },
              hideClass: { popup: 'animate__animated animate__fadeOut' }
            });
          }
        });
      }
    };
    socket.on('callRequest', handleIncomingCall);
    return () => socket.off('callRequest', handleIncomingCall);
  }, [roomCode, username, navigate]);

  // Update the message rendering part
  const renderMessage = (msg, index) => {
    const isMyMessage = msg.username === username;
    const isDeleted = msg.isDeleted;
    const isShowingActions = showActions === msg.id;
    // Determine the media type from the MIME type for robust rendering
    const mediaType = msg.attachment ? getMediaTypeFromMime(msg.attachment.mime) : null;

    // --- FIX: Ensure URL is absolute and use mobile-friendly endpoint for images ---
    let attachmentUrl = msg.attachment?.url || msg.attachment?.preview;
    if (msg.attachment && !msg.attachment.isLocal && attachmentUrl) {
      if (attachmentUrl.startsWith('/')) {
        // For images, use the mobile-friendly endpoint
        if (mediaType === "image") {
          const filename = attachmentUrl.split('/').pop();
          attachmentUrl = `${API_URL}/image/${filename}`;
        } else {
          attachmentUrl = `${API_URL}${attachmentUrl}`;
        }
      }
    }
    if (msg.attachment && msg.attachment.isLocal && !isMyMessage) {
      return null;
    }
    let audioUrl = constructAudioUrl(msg.audio);
    if (audioUrl) {
      console.log('Final audio URL:', audioUrl);
    }
    const messageStyle = {
      maxWidth: "70%",
      borderRadius: "12px",
      boxShadow: isMyMessage
        ? "0 4px 20px rgba(0, 123, 255, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)"
        : "0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)",
      position: "relative",
      marginLeft: isMyMessage ? "auto" : 0,
      marginRight: isMyMessage ? 0 : "auto",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      backdropFilter: "blur(10px)",
      border: isMyMessage
        ? "1px solid rgba(0, 123, 255, 0.2)"
        : "1px solid rgba(255, 255, 255, 0.1)",
      opacity: isDeleted ? 0.6 : 1,
      cursor: isMyMessage ? "pointer" : "default",
      background: isMyMessage
        ? "linear-gradient(135deg, rgba(0, 123, 255, 0.95) 0%, rgba(0, 86, 179, 0.95) 100%)"
        : "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%)",
      animation: "messageSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    };
    if (msg.attachment) {
      console.log('Attachment object:', msg.attachment);
    }
    // For image attachments, always render inline for mobile
    if (msg.attachment && mediaType === "image") {
      return (
        <div key={msg.id} className={`d-flex ${isMyMessage ? "justify-content-end" : "justify-content-start"}`}
          style={{ animation: `messageSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s both` }}>
          <div className={`p-3 m-2 message-container`} style={messageStyle}>
            {!isMyMessage && (
              <div style={{ fontSize: "0.75rem", color: "#6c757d", marginBottom: "6px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>{msg.username}</div>
            )}
            <div style={{ borderRadius: "10px", overflow: "hidden", marginBottom: 8, minHeight: 40, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {msg.isSending ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <div className="spinner-border text-primary" role="status" style={{ width: 32, height: 32, marginBottom: 6 }} />
                  <span style={{ color: '#007bff', fontWeight: 600, fontSize: 13 }}>Uploading...</span>
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ margin: '4px 0', padding: '4px 12px', fontWeight: 600 }}
                  onClick={() => {
                    // Open image in new tab using ngrok URL
                    const imageUrl = `${API_URL}/image/${attachmentUrl.split('/').pop()}`;
                    window.open(imageUrl, '_blank');
                  }}
                >
                  View Image
                </button>
              )}
            </div>
            {/* ...rest of message rendering... */}
          </div>
        </div>
      );
    }
    return (
      <div
        key={msg.id}
        className={`d-flex ${isMyMessage ? "justify-content-end" : "justify-content-start"}`}
        style={{
          animation: `messageSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s both`,
        }}
      >
        <div
          className={`p-3 m-2 message-container`}
          style={messageStyle}
          onMouseDown={(e) => {
            if (isMyMessage) {
              handleMessagePress(msg.id, e);
            }
          }}
          onMouseUp={(e) => {
            if (isMyMessage) {
              handleMessageRelease(e);
            }
          }}
          onMouseLeave={(e) => {
            if (isMyMessage) {
              handleMessageRelease(e);
            }
          }}
          onDoubleClick={(e) => {
            if (isMyMessage) {
              handleMessageDoubleClick(msg.id, e);
            }
          }}
          onTouchStart={(e) => {
            if (isMyMessage) {
              handleTouchStart(msg.id, e);
            }
          }}
          onTouchEnd={(e) => {
            if (isMyMessage) {
              handleTouchEnd(e);
            }
          }}
          onContextMenu={(e) => {
            if (isMyMessage) {
              e.preventDefault();
            }
          }}
        >
          {!isMyMessage && (
            <div style={{
              fontSize: "0.75rem",
              color: "#6c757d",
              marginBottom: "6px",
              fontWeight: "600",
              letterSpacing: "0.5px",
              textTransform: "uppercase"
            }}>
              {msg.username}
            </div>
          )}

          {msg.attachment && (
            <div className="mt-2" style={{ borderRadius: "10px", overflow: "hidden" }}>
              {mediaType === "video" ? (
                <video
                  src={attachmentUrl}
                  controls
                  className="img-fluid rounded"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              ) : mediaType === "image" ? (
                <>
                  {console.log('Attachment debug:', { mediaType, url: msg.attachment?.url, mimetype: msg.attachment?.mimetype })}
                  <button
                    className="btn btn-primary"
                    style={{ margin: '8px 0', padding: '6px 16px', fontWeight: 600 }}
                    onClick={() => {
                      setExpandedImages(prev => ({
                        ...prev,
                        [msg.id]: !prev[msg.id]
                      }));
                    }}
                  >
                    {expandedImages[msg.id] ? 'Hide Image' : 'View Image'}
                  </button>
                  {expandedImages[msg.id] && (
                    <div className="mt-2" style={{
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      padding: '8px'
                    }}>
                      <img
                        src={`${API_URL}/image/${(msg.attachment?.url || '').split('/').pop()}`}
                        alt="Preview"
                        style={{
                          width: '100%',
                          maxWidth: '400px',
                          height: 'auto',
                          borderRadius: '6px',
                          display: 'block',
                          objectFit: 'contain'
                        }}
                        onLoad={() => {
                          setImageLoadState(prev => ({
                            ...prev,
                            [msg.id]: { loading: false, error: false }
                          }));
                        }}
                        onError={() => {
                          setImageLoadState(prev => ({
                            ...prev,
                            [msg.id]: { loading: false, error: true }
                          }));
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="d-flex align-items-center file-message"
                  style={{ textDecoration: 'none', color: getTextColor(msg.username) }}
                >
                  <i className="fas fa-file-alt me-2"></i>
                  <span>{msg.attachment.name || 'Download File'}</span>
                </a>
              )}
            </div>
          )}

          {msg.audio && (
            <div className="mt-2 audio-container">
              <SimpleAudioPlayerWrapper audioObj={msg.audio} />
            </div>
          )}

          {!isMyMessage && (
            <div style={{
              fontSize: "0.75rem",
              color: "#6c757d",
              marginBottom: "6px",
              fontWeight: "600",
              letterSpacing: "0.5px",
              textTransform: "uppercase"
            }}>

            </div>
          )}

          {editingMessage?.id === msg.id ? (
            <div className="edit-message-container" style={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              padding: "10px",
              borderRadius: "8px",
              marginBottom: "10px"
            }}>
              <textarea
                className="form-control mb-2"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  borderRadius: "4px",
                  padding: "8px",
                  minHeight: "60px",
                  resize: "vertical"
                }}
              />
              <div className="d-flex gap-2 justify-content-end">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleCancelEdit}
                  style={{
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    padding: "5px 15px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-success"
                  onClick={handleSaveEdit}
                  style={{
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    padding: "5px 15px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              {isDeleted ? (
                <div style={{
                  color: isMyMessage ? "rgba(255,255,255,0.7)" : "rgba(108, 117, 125, 0.8)",
                  fontStyle: "italic",
                  fontSize: "0.85rem",
                  padding: "5px 0"
                }}>
                  This message was deleted by {msg.deletedBy || msg.username}
                </div>
              ) : (
                <>
                  {msg.message && (
                    <div style={{
                      color: isMyMessage ? "#ffffff" : "#2c3e50",
                      wordBreak: "break-word",
                      lineHeight: "1.5",
                      padding: "5px 0",
                      fontWeight: "400",
                      fontSize: "0.95rem"
                    }}>
                      {msg.message}
                      {msg.isEdited && (
                        <span style={{
                          fontSize: "0.7rem",
                          color: isMyMessage ? "rgba(255,255,255,0.7)" : "rgba(44, 62, 80, 0.6)",
                          marginLeft: "5px",
                          fontStyle: "italic"
                        }}>
                          (edited)
                        </span>
                      )}
                    </div>
                  )}

                  {isMyMessage && !isDeleted && isShowingActions && (
                    <div
                      className="message-actions"
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        display: "flex",
                        gap: "5px",
                        zIndex: 10,
                        animation: "fadeIn 0.2s ease",
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                        padding: "5px",
                        borderRadius: "4px",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                      }}
                    >
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => handleEditMessage(msg)}
                        style={{
                          padding: "0.2rem 0.4rem",
                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "1rem",
                          transition: "all 0.2s ease"
                        }}
                        title="Edit message"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => handleDeleteMessage(msg.id)}
                        style={{
                          padding: "0.2rem 0.4rem",
                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "1rem",
                          transition: "all 0.2s ease"
                        }}
                        title="Delete message"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="text-end" style={{
            fontSize: "0.75rem",
            color: "#2196f3",
            marginTop: "4px"
          }}>
            {isMyMessage && (
              <span style={{ marginRight: "10px", display: 'inline-flex', verticalAlign: 'middle' }}>
                <svg width="15" height="11" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 4px #2196f3)' }}>
                  <path d="M1.5 8.5L7.5 14.5L20.5 1.5" stroke="#2196f3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8.5 8.5L14.5 14.5L21.5 7.5" stroke="#2196f3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            {msg.timestamp}
            {msg.isSending && <span className="ms-2">Sending...</span>}
          </div>

          {msg.likes?.length > 0 && (
            <div className="text-start mt-1" style={{
              fontSize: "0.75rem",
              color: `${getTextColor(msg.username)}CC`
            }}>
              ❤️ {msg.likes.length}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Update the styles
  const messageStyles = `
    .message-container {
      position: relative;
    }

    .message-actions {
      animation: fadeIn 0.2s ease;
    }

    .message-actions button:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .edit-message-container textarea:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    }

    .edit-message-container button:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (hover: none) {
      .message-actions {
        display: flex !important;
        opacity: 1 !important;
      }
    }
  `;

  // Add click outside handler to hide actions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActions && !event.target.closest('.message-container')) {
        setShowActions(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActions]);

  const [isNoteTaking, setIsNoteTaking] = useState(false);
  const [isWhiteboard, setIsWhiteboard] = useState(false);
  const [showCallManager, setShowCallManager] = useState(false);

  // Refs for various elements
  const localVideoRef = useRef(null);
  const chatMainRef = useRef(null); // Ref for the chat main area
  // Remove showScrollToBottom state and related logic
  // Remove chatMainRef scroll event handler
  // Only keep auto-scroll to bottom on new message

  // Always scroll to bottom on new message (sent or received)
  useEffect(() => {
    const el = chatMainRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  // One-time scroll to bottom only on send
  useEffect(() => {
    if (!shouldScrollOnSend) return;
    const el = chatMainRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      setShouldScrollOnSend(false);
    });
  }, [messages, shouldScrollOnSend]);

  // Check backend audio serving
  const checkBackendAudio = async () => {
    console.log('Checking backend audio serving...');

    try {
      // Test the known working MP3 file
      const testUrl = 'https://ee4f990101f9.ngrok-free.app/uploads/file-1752328973823-649946839.mp3';
      const response = await fetch(testUrl, { method: 'HEAD' });

      console.log('Backend test response:', response.status, response.statusText);
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Content-Length:', response.headers.get('content-length'));
      console.log('Accept-Ranges:', response.headers.get('accept-ranges'));
      console.log('Cache-Control:', response.headers.get('cache-control'));

      if (response.ok) {
        console.log('✅ Backend is serving audio files correctly');
        return true;
      } else {
        console.error('❌ Backend audio serving issue:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Backend audio test failed:', error);
      return false;
    }
  };

  // Enhanced audio debugging
  const debugAudioPlayback = async (audioUrl) => {
    console.log('=== Audio Debugging ===');
    console.log('URL:', audioUrl);
    console.log('User Agent:', navigator.userAgent);
    console.log('Platform:', navigator.platform);

    // Check backend
    const backendOk = await checkBackendAudio();

    // Test the specific URL
    const urlTest = await testAudioUrl(audioUrl);

    // Check browser audio support
    const audioSupport = {
      webm: MediaRecorder.isTypeSupported('audio/webm'),
      mp3: MediaRecorder.isTypeSupported('audio/mp3'),
      wav: MediaRecorder.isTypeSupported('audio/wav'),
      ogg: MediaRecorder.isTypeSupported('audio/ogg')
    };

    console.log('Browser audio support:', audioSupport);
    console.log('Backend OK:', backendOk);
    console.log('URL test:', urlTest);

    return {
      backendOk,
      urlTest,
      audioSupport,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };
  };

  // Auto-debug audio issues
  const autoDebugAudio = async (audioUrl, error) => {
    console.log('Auto-debugging audio issue...');

    const debugInfo = await debugAudioPlayback(audioUrl);

    // If backend is OK but URL test fails, try alternative URLs
    if (debugInfo.backendOk && !debugInfo.urlTest.success) {
      console.log('Backend OK but URL failed, trying alternatives...');
      const alternativeUrl = await tryAlternativeAudioUrl(audioUrl);

      if (alternativeUrl) {
        console.log('Found working alternative, updating audio element...');
        return { success: true, alternativeUrl };
      }
    }

    // If it's an iOS device, suggest specific fixes
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.log('iOS device detected, suggesting iOS-specific fixes...');
      return {
        success: false,
        suggestion: 'iOS detected. Try the "Alt" button for iOS-compatible URL.'
      };
    }

    return {
      success: false,
      suggestion: 'Audio format may not be supported. Try the "Simple" player as fallback.'
    };
  };

  // Add state for image modal


  // Add state for image loading/error per message
  const [imageLoadState, setImageLoadState] = useState({}); // { [msgId]: { loading: bool, error: bool } }
  const [expandedImages, setExpandedImages] = useState({}); // { [msgId]: bool }

  // Add at the top of ChatMain function:
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef(null);

  // Add effect to close menu when clicking outside
  useEffect(() => {
    if (!showHeaderMenu) return;
    function handleClick(e) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowHeaderMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHeaderMenu]);

  return (
    <div
      className="chat-container container-fluid"
      style={{
        minHeight: '100vh',
        minWidth: '100vw',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Beams at the very back */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Beams rotation={45} lightColor="#00b7eb" />
      </div>
      {/* Background image above Beams, but below content */}
      {backgroundImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            background: `url(${backgroundImage}) center center/cover no-repeat fixed`,
            pointerEvents: 'none',
            transition: 'background 0.5s',
          }}
        />
      )}
      {/* Main chat content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Header - Fixed to Top */}
        <header
          className="chat-header"
          style={{
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '0 0 20px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            marginBottom: '0',
            padding: '0',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            width: '100vw',
            minHeight: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 'env(safe-area-inset-top, 12px)',
            paddingBottom: 8,
          }}
        >
          <div className="w-100 d-flex align-items-center justify-content-between px-2" style={{ minHeight: 60, position: 'relative' }}>
            {/* Leave Button (left) */}
            <button
              className="btn btn-sm d-flex align-items-center"
              style={{
                minWidth: 44,
                minHeight: 44,
                background: 'linear-gradient(90deg, #ff4d4d 0%, #2c5364 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 600,
                fontSize: '1.1rem',
                boxShadow: '0 1px 4px rgba(255,77,77,0.12)',
                padding: '8px 14px',
                zIndex: 2,
                marginRight: 8,
              }}
              title="Leave Room"
              onClick={() => navigate("/ChatLanding")}
            >
              <span role="img" aria-label="leave" style={{ fontSize: 22 }}>🚪</span>
            </button>
            {/* Room Code (center) */}
            <span
              className="px-2 py-2 text-truncate"
              style={{
                background: 'rgba(0,183,235,0.18)',
                borderRadius: '18px',
                fontWeight: 700,
                color: '#fff',
                fontSize: '1.25rem',
                letterSpacing: '0.5px',
                boxShadow: '0 1px 4px rgba(0,183,235,0.10)',
                fontFamily: 'monospace',
                maxWidth: '60vw',
                minWidth: 0,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1,
                flexGrow: 1,
              }}
            >
              <span role="img" aria-label="Room" style={{ marginRight: 6 }}>#️⃣</span>
              {roomCode}
            </span>
            {/* Menu Icon (right) */}
            <button
              className="btn btn-sm d-flex align-items-center justify-content-center"
              style={{
                minWidth: 44,
                minHeight: 44,
                background: 'rgba(255,255,255,0.10)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 600,
                fontSize: '1.5rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                padding: '8px 14px',
                zIndex: 2,
                marginLeft: 8,
              }}
              title="Menu"
              onClick={() => setShowHeaderMenu(v => !v)}
              aria-label="Open menu"
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>⋮</span>
            </button>
            {/* Interactive Dropdown Menu */}
            {showHeaderMenu && (
              <div ref={headerMenuRef} style={{
                position: 'absolute',
                top: 54,
                right: 0,
                minWidth: 160,
                background: 'rgba(30, 34, 44, 0.98)',
                borderRadius: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                zIndex: 1000,
                padding: '10px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                <div className="menu-item" style={{ padding: '10px 20px', color: '#fff', fontWeight: 500, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span role="img" aria-label="users">👥</span> {userCount} online
                </div>
                <div
                  className="menu-item"
                  style={{ padding: '10px 20px', color: '#fff', fontWeight: 500, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => { setShowHeaderMenu(false); navigate('/voicecall', { state: { roomCode, username } }); }}
                >
                  <span role="img" aria-label="call">📞</span> Call
                </div>
                <div
                  className="menu-item"
                  style={{ padding: '10px 20px', color: '#fff', fontWeight: 500, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => { setShowHeaderMenu(false); fileInputRef.current && fileInputRef.current.click(); }}
                >
                  <span role="img" aria-label="background">🖼️</span> Background
                </div>
              </div>
            )}
          </div>
          <style>{`
            @media (max-width: 576px) {
              .chat-header { border-radius: 0 0 12px 12px !important; }
              .chat-header .text-truncate { max-width: 60vw !important; }
              .chat-header .btn { font-size: 1.1rem !important; padding: 8px 14px !important; min-width: 44px !important; min-height: 44px !important; }
            }
          `}</style>
        </header>

        {/* Main Chat Area - Scrollable, fills space between header and footer */}
        <main ref={chatMainRef} className="chat-main" style={{
          flex: 1,
          marginTop: '80px', // height of header
          marginBottom: '80px', // height of footer
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE 10+
          position: 'relative',
          zIndex: 1,
        }}>
          <div className="row" style={{ height: '100%' }}>
            <div className="col-12">
              <div className="messages-container" ref={messagesEndRef} style={{ minHeight: '100%', paddingBottom: '10px', position: 'relative', zIndex: 1 }}>
                {messages.map((msg, index) => renderMessage(msg, index))}
              </div>
            </div>
          </div>
          {/* Scroll to bottom button (always visible for debug) */}
          {/* Remove the scroll-to-bottom button from the JSX */}
        </main>

        {/* Footer - Fixed to Bottom */}
        <footer className="chat-footer" style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          width: '100vw',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
          padding: '10px 0',
        }}>
          <div className="row align-items-center" style={{ margin: 0 }}>
            <div className="col-12">
              <form className="d-flex align-items-center gap-2" style={{ maxWidth: 600, margin: '0 auto' }}
                onSubmit={e => {
                  e.preventDefault(); // Prevent page reload and scroll to top
                  handleSendMessage();
                }}
              >
                {/* File attachment button */}
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRecording}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#666',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontWeight: 500,
                    fontSize: '1rem',
                    padding: '9px 12px',
                    outline: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.2s',
                    minWidth: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Attach file"
                >
                  📎
                </button>

                {/* Audio recording button */}
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={isRecording ? stopRecording : startRecording}
                  style={{
                    background: isRecording ? '#dc3545' : 'rgba(255, 255, 255, 0.9)',
                    color: isRecording ? '#fff' : '#dc3545',
                    border: `1px solid ${isRecording ? '#dc3545' : '#dc3545'}`,
                    borderRadius: '8px',
                    fontWeight: 500,
                    fontSize: '1rem',
                    padding: '9px 12px',
                    outline: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.2s',
                    minWidth: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={isRecording ? "Stop recording" : "Record audio"}
                >
                  {isRecording ? '⏹️' : '🎤'}
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setAttachment(file);
                    }
                  }}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                />

                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  placeholder="Type a message..."
                  className="form-control"
                  style={{
                    background: '#fff',
                    color: '#222',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    fontWeight: 400,
                    fontSize: '1rem',
                    outline: 'none',
                    padding: '10px 14px',
                    letterSpacing: '0.2px',
                    flex: 1,
                    boxShadow: 'none',
                  }}
                  disabled={isRecording}
                />
                <button
                  type="submit"
                  className={`btn send-btn${sendAnimating ? ' animating' : ''}`}
                  style={{
                    background: (attachment || recordedAudio) ? '#007bff' : '#e0e0e0',
                    color: (attachment || recordedAudio) ? '#fff' : '#222',
                    border: `1px solid ${(attachment || recordedAudio) ? '#007bff' : '#bbb'}`,
                    borderRadius: '8px',
                    fontWeight: 500,
                    fontSize: '1rem',
                    padding: '9px 22px',
                    outline: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'visible',
                    minWidth: 70,
                  }}
                  disabled={(!input.trim() && !attachment && !recordedAudio) || sendAnimating}
                >
                  <span style={{ transition: 'visibility 0.2s' }}>
                    {attachment ? '📎 Send' : recordedAudio ? '🎤 Send' : 'Send'}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </footer>
        {/* Hide scrollbar for all browsers */}
        <style>{`
          .chat-main::-webkit-scrollbar { display: none; }
          .chat-main { -ms-overflow-style: none; scrollbar-width: none; }
          
          /* Ensure smooth scrolling */
          .chat-main {
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Allow scrolling on message containers */
          .message-container {
            pointer-events: auto;
          }
          
          /* Prevent text selection on interactive elements only */
          .message-actions {
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
          }
        `}</style>

        {/* Preview Overlay */}
        {previewBackground && (
          <div className="preview-overlay" style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <div className="preview-content" style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "10px",
              textAlign: "center"
            }}>
              <h4 className="mb-4">Preview Background</h4>
              <div className="button-group">
                <button
                  className="btn btn-success mx-2"
                  onClick={confirmBackground}
                >
                  Confirm
                </button>
                <button
                  className="btn btn-danger mx-2"
                  onClick={cancelPreview}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Local audio preview (only if we have recordedAudio) */}
        {recordedAudio && (
          <div
            className="position-fixed"
            style={{
              bottom: "70px",
              left: "120px", // move it so it doesn't overlap the attachment preview
              background: "#fff",
              padding: "5px",
              border: "1px solid #ccc",
              borderRadius: "5px",
              zIndex: 11,
            }}
          >
            <audio
              src={URL.createObjectURL(recordedAudio)}
              controls
              style={{
                width: "250px",
                height: "40px"
              }}
            />
            <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "5px" }}>
              Preview your recording
            </div>
          </div>
        )}

        {/* Attachment preview (if any) */}
        {attachment && (
          <div
            className="position-fixed"
            style={{
              bottom: "70px",
              left: "10px",
              background: "#fff",
              padding: "5px",
              border: "1px solid #ccc",
              borderRadius: "5px",
              zIndex: 11,
            }}
          >
            <div style={{ position: 'relative' }}>
              {/* Clear attachment button */}
              <button
                onClick={() => setAttachment(null)}
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  zIndex: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Remove attachment"
              >
                ×
              </button>

              {/* File preview */}
              {attachment.type.startsWith("video/") ? (
                <video
                  src={URL.createObjectURL(attachment)}
                  controls
                  style={{ maxWidth: "100px", maxHeight: "100px" }}
                />
              ) : attachment.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(attachment)}
                  alt="preview"
                  style={{ maxWidth: "100px", maxHeight: "100px" }}
                />
              ) : (
                <div style={{
                  width: "100px",
                  height: "100px",
                  background: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  fontSize: "12px",
                  color: "#6c757d"
                }}>
                  <div style={{ fontSize: "24px", marginBottom: "4px" }}>📄</div>
                  <div style={{ textAlign: "center", wordBreak: "break-word" }}>
                    {attachment.name}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add CSS for speech bubbles */}
        <style>
          {`
            @keyframes messageSlideIn {
              0% {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            @keyframes messageHover {
              0% {
                transform: translateY(0);
              }
              100% {
                transform: translateY(-2px);
              }
            }

            .message-container:hover {
              animation: messageHover 0.2s ease forwards;
            }

            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }

            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }

            .chat-bubble {
              position: relative;
            }

            .chat-bubble::after {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              border-radius: inherit;
              box-shadow: 0 0 15px rgba(0, 123, 255, 0.1);
              opacity: 0;
              animation: glowPulse 2s ease-in-out infinite;
            }

            @keyframes glowPulse {
              0% {
                opacity: 0;
              }
              50% {
                opacity: 0.5;
              }
              100% {
                opacity: 0;
              }
            }

            .chat-bubble::before {
              content: '';
              position: absolute;
              width: 0;
              height: 0;
              border-style: solid;
            }

            .chat-bubble.sent::before {
              right: -8px;
              top: 0;
              border-width: 0 0 15px 15px;
              border-color: transparent transparent #007bff transparent;
            }

            .chat-bubble.received::before {
              left: -8px;
              top: 0;
              border-width: 0 15px 15px 0;
              border-color: transparent #f8f9fa transparent transparent;
            }

            /* Add smooth scrolling to the messages container */
            main {
              scroll-behavior: smooth;
            }

            /* Add a subtle glow effect to messages */
            .message-glow {
              box-shadow: 0 0 10px rgba(0, 123, 255, 0.2);
            }
          `}
        </style>

        <style>
          {`
            .back-btn, .background-btn {
              padding: 0.5rem 1rem;
              font-size: 1rem;
              border-radius: 20px;
              transition: all 0.3s ease;
            }

            .back-btn:hover, .background-btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }

            .room-title {
              font-size: clamp(0.875rem, 2vw, 1.25rem);
              word-break: break-word;
            }

            @media (max-width: 576px) {
              .back-btn, .background-btn {
                padding: 0.375rem 0.75rem;
                font-size: 1.25rem;
              }

              header {
                padding: 8px !important;
              }

              .room-title {
                font-size: 0.875rem;
              }
            }

            @media (max-width: 768px) {
              header {
                padding: 10px !important;
              }

              .room-title {
                font-size: 1rem;
              }
            }

            @media (min-width: 769px) {
              .back-btn, .background-btn {
                padding: 0.5rem 1.25rem;
              }
            }

            /* Responsive style for Change Background button on mobile */
            @media (max-width: 576px) {
              .change-bg-btn-wrapper {
                position: absolute !important;
                top: 10px;
                right: 10px;
                z-index: 1100;
              }
              .background-btn {
                font-size: 0.8rem !important;
                padding: 0.25rem 0.5rem !important;
                border-radius: 14px !important;
              }
              .background-btn span[role="img"] {
                font-size: 1rem !important;
              }
              .background-btn span.d-none.d-sm-inline {
                display: none !important;
              }
              
              /* Call manager button responsive styling */
              .call-manager-btn-wrapper {
                position: absolute !important;
                top: 10px;
                right: 60px;
                z-index: 1100;
              }
              .call-manager-btn {
                font-size: 0.8rem !important;
                padding: 0.25rem 0.5rem !important;
                border-radius: 14px !important;
              }
              .call-manager-btn span[role="img"] {
                font-size: 1rem !important;
              }
              .call-manager-btn span.d-none.d-sm-inline {
                display: none !important;
              }
            }
          `}
        </style>

        <style>
          {messageStyles}
        </style>

        {typingUsers.length > 0 && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 85,
            zIndex: 10,
            textAlign: 'center',
            color: '#00b7eb',
            fontWeight: 500,
            fontSize: '1rem',
            pointerEvents: 'none',
            textShadow: '0 1px 4px #fff, 0 0 8px #00b7eb44',
            transition: 'opacity 0.2s',
            opacity: 1
          }}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is typing...' : 'are typing...'}
          </div>
        )}

        {/* Call Manager Component */}
        <CallManager
          roomCode={roomCode}
          username={username}
          isVisible={showCallManager}
          onClose={() => setShowCallManager(false)}
        />
        {showVoiceCall && (
          <VoiceCall roomCode={roomCode} onClose={() => setShowVoiceCall(false)} />
        )}


      </div>
    </div>
  );
}

export default ChatMain;

// Add this component at the bottom of the file:
const SimpleAudioPlayerWrapper = ({ audioObj }) => {
  const [audioUrl, setAudioUrl] = React.useState(null);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const url = await getPlayableAudioUrl(audioObj);
      if (mounted) setAudioUrl(url);
    })();
    return () => { mounted = false; };
  }, [audioObj]);
  if (!audioUrl) return <div>Loading audio...</div>;
  return <SimpleAudioPlayer src={audioUrl} />;
};

// Add this helper at the top of the file (after imports):
function isImageAttachment(attachment, mediaType) {
  if (!attachment) return false;
  const url = attachment.url || '';
  const mimetype = attachment.mimetype || '';
  // Check extension
  const isExt = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  // Check mimetype
  const isMime = mimetype.startsWith('image/');
  // Check mediaType
  const isMedia = mediaType === 'image';
  return isExt || isMime || isMedia;
}