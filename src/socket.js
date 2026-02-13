// socket.js
import { io } from "socket.io-client";

const API_URL = 'https://b8ba-183-87-251-162.ngrok-free.app'; // backend ngrok URL

// centralized socket instance
const socket = io(API_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  path: '/socket.io/'
});

socket.on("connect", () => {
  console.log("✅ Connected to WebSocket server:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("❌ WebSocket connection error:", error.message);

  // Log more detailed error information
  if (error.message === "server error") {
    console.error("Server-side error details:", {
      description: error.description,
      type: error.type,
      context: error.context
    });
  }

  // If we're in development and the error is about connection refused
  if (process.env.NODE_ENV === 'development' &&
    (error.message.includes('timeout') || error.message.includes('refused'))) {
    console.log("⚠️ Make sure your backend server is running on the ngrok URL");
  }

  // Try to reconnect with polling if websocket fails
  if (socket.io.opts.transports[0] === 'websocket') {
    console.log("Attempting to reconnect with polling transport...");
    socket.io.opts.transports = ['polling', 'websocket'];
  }
});

socket.on("disconnect", (reason) => {
  console.log("WebSocket disconnected:", reason);
  if (reason === "io server disconnect") {
    // The disconnection was initiated by the server, try to reconnect
    socket.connect();
  }
});

// Add error event handler
socket.on("error", (error) => {
  console.error("Socket error:", error);
});

// Add connect_timeout handler
socket.on("connect_timeout", (timeout) => {
  console.error("Connection timeout after", timeout, "ms");
});

// Add reconnect_attempt handler
socket.on("reconnect_attempt", (attemptNumber) => {
  console.log("Attempting to reconnect... (Attempt", attemptNumber, ")");
});

// Add reconnect_failed handler
socket.on("reconnect_failed", () => {
  console.error("Failed to reconnect to the server");
});

export default socket;
