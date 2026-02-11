// useChat.js
import { useState, useEffect, useRef } from "react";
import socket from "./socket";

// Debug WebSocket Connection
socket.on("connect", () => {
  console.log("✅ Connected to WebSocket server:", socket.id);
});
socket.on("connect_error", (err) => {
  console.log("❌ Connection Error:", err.message);
});

export default function useChat() {
  // Chat states
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [generatedRoom, setGeneratedRoom] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [inRoom, setInRoom] = useState(false);
  const [error, setError] = useState(null);
  const [userCount, setUserCount] = useState(0);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Typing indicator state (for other users)
  const [typingUsers, setTypingUsers] = useState([]);

  // Create and join room functions
  const createRoom = () => {
    if (!username.trim()) {
      setError("Please enter your name before creating a room!");
      return;
    }
    socket.emit("createRoom", username);
  };

  const joinRoom = () => {
    const trimmedRoomCode = roomCode.trim();
    if (!username.trim()) {
      setError("Please enter your name before joining a room!");
      return;
    }
    if (trimmedRoomCode !== "") {
      console.log(`🔍 Attempting to join room: ${trimmedRoomCode}`);
      socket.emit("joinRoom", { roomCode: trimmedRoomCode, username });
    } else {
      setError("❌ Please enter a valid room code!");
    }
  };

  // Listen for server events
  useEffect(() => {
    socket.on("roomCreated", (room) => {
      setGeneratedRoom(room);
      setInRoom(true);
      setError(null);
      console.log("✅ Room created:", room);
    });
    socket.on("roomJoined", (room) => {
      setGeneratedRoom(room);
      setInRoom(true);
      setError(null);
      console.log("✅ Joined room:", room);
    });
    socket.on("userCount", (count) => {
      setUserCount(count);
    });
    socket.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on("error", (errorMessage) => {
      setError(errorMessage);
      console.log(`❌ Error: ${errorMessage}`);
    });
    // Listen for typing events from other users
    socket.on("userTyping", (data) => {
      if (data.username !== username) {
        setTypingUsers((prev) => {
          if (!prev.includes(data.username)) return [...prev, data.username];
          return prev;
        });
        // Remove the typing indicator after 2 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((user) => user !== data.username));
        }, 2000);
      }
    });
    // Listen for like events from the server
    socket.on("receiveLike", (data) => {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const idx = data.messageIndex;
        if (newMessages[idx]) {
          if (!newMessages[idx].reactions) newMessages[idx].reactions = {};
          newMessages[idx].reactions["❤️"] =
            (newMessages[idx].reactions["❤️"] || 0) + 1;
        }
        return newMessages;
      });
    });

    // Clean up listeners on unmount
    return () => {
      socket.off("roomCreated");
      socket.off("roomJoined");
      socket.off("userCount");
      socket.off("receiveMessage");
      socket.off("error");
      socket.off("userTyping");
      socket.off("receiveLike");
    };
  }, [username]);

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });
      mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setRecordedAudio(reader.result);
        };
      });
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle message change (for typing indicator)
  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    if (generatedRoom) {
      socket.emit("typing", { roomCode: generatedRoom, username });
    }
  };

  // Modified sendMessage function to accept an optional attachment.
  // It expects an object which may contain { message, audio, attachment, timestamp }
  const sendMessage = (msgObj = {}) => {
    if (!generatedRoom) return;
    // If there's no text, audio, and no attachment, do nothing
    if (
      (!msgObj.message || msgObj.message.trim() === "") &&
      !msgObj.audio &&
      !msgObj.attachment
    )
      return;
    const timestamp = msgObj.timestamp || new Date().toLocaleTimeString();
    socket.emit("sendMessage", {
      roomCode: generatedRoom,
      username,
      message: msgObj.message,
      audio: msgObj.audio,
      attachment: msgObj.attachment,
      timestamp,
    });
    // Clear message and audio after sending
    setMessage("");
    setRecordedAudio(null);
  };

  // Handle double tap (like) event
  const handleDoubleTap = (messageIndex) => {
    socket.emit("likeMessage", { roomCode: generatedRoom, messageIndex });
  };

  // Local reaction (for manual clicks)
  const addReaction = (index, emoji) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages];
      const msg = newMessages[index];
      if (!msg.reactions) msg.reactions = {};
      if (!msg.reactions[emoji]) msg.reactions[emoji] = 0;
      msg.reactions[emoji] += 1;
      return newMessages;
    });
    if (emoji === "❤️") {
      socket.emit("likeMessage", { roomCode: generatedRoom, messageIndex: index });
    }
  };

  // Clear chat messages
  const clearChat = () => {
    setMessages([]);
  };

  return {
    username,
    setUsername,
    roomCode,
    setRoomCode,
    generatedRoom,
    message,
    setMessage,
    messages,
    inRoom,
    error,
    userCount,
    isRecording,
    recordedAudio,
    typingUsers,
    createRoom,
    joinRoom,
    startRecording,
    stopRecording,
    handleMessageChange,
    sendMessage,
    handleDoubleTap,
    addReaction,
    clearChat,
  };
}
