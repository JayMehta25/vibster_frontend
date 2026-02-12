import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "./socket";
import "bootstrap/dist/css/bootstrap.min.css";
import Particles from './particlepage';
import Swal from 'sweetalert2';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

function ChatLanding() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [bubbleColor, setBubbleColor] = useState("#007bff"); // Default color
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showQRCode, setShowQRCode] = useState(false);
  const [generatedRoomCode, setGeneratedRoomCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [scanAnimation, setScanAnimation] = useState(false);
  const [mazeProgress, setMazeProgress] = useState(0);
  const [mazeInterval, setMazeInterval] = useState(null);
  const [currentMazePath, setCurrentMazePath] = useState([]);

  // Unified maze animation function
  const startMazeAnimation = (roomCodeToJoin) => {
    console.log("Starting maze animation for room:", roomCodeToJoin);

    // Start maze animation
    setScanAnimation(true);
    setMazeProgress(0);
    setCurrentMazePath(generateSingleMazePath());

    // Start maze animation that auto-completes every 5 seconds
    const interval = setInterval(() => {
      setMazeProgress(prev => {
        console.log("Maze progress:", prev);
        if (prev >= 100) {
          // Maze completed, show alert and join room
          clearInterval(interval);
          setMazeInterval(null);
          setScanAnimation(false);

          Swal.fire({
            title: 'Room Found!',
            text: `Joining room: ${roomCodeToJoin}`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            // Store user info for room
            const roomData = {
              roomCode: roomCodeToJoin,
              username: username,
              bubbleColor: bubbleColor,
              isOffline: !isOnline,
              createdAt: new Date().toISOString()
            };
            localStorage.setItem(`room_${roomCodeToJoin}`, JSON.stringify(roomData));

            navigate("/chatmain", {
              state: {
                username,
                roomCode: roomCodeToJoin,
                isMaster: false,
                bubbleColor: bubbleColor,
                isOffline: !isOnline
              }
            });
          });
          return 100;
        }
        return prev + 2; // Increment by 2% every 100ms (5 seconds total)
      });
    }, 100);

    setMazeInterval(interval);
  };

  // Monitor online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Generate random room code for offline mode
  const generateOfflineRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate single random maze path
  const generateSingleMazePath = () => {
    const path = [];
    let x = 0, y = 0;
    const targetX = 14, targetY = 14; // 15x15 maze, so max index is 14

    path.push({ x, y }); // Start point

    while (x < targetX || y < targetY) {
      // Randomly choose to move right or down
      if (x < targetX && y < targetY) {
        // Can move both directions
        if (Math.random() > 0.5) {
          x++;
        } else {
          y++;
        }
      } else if (x < targetX) {
        // Can only move right
        x++;
      } else {
        // Can only move down
        y++;
      }
      path.push({ x, y });
    }

    return path;
  };

  const handleGenerateQR = () => {
    if (!username.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter your username',
        icon: 'warning'
      });
      return;
    }

    if (!isOnline) {
      // Offline mode - generate room locally and show QR code
      const offlineRoomCode = generateOfflineRoomCode();
      setGeneratedRoomCode(offlineRoomCode);
      setShowQRCode(true);
      // Store room info in localStorage for offline chat
      const roomData = {
        roomCode: offlineRoomCode,
        username: username,
        bubbleColor: bubbleColor,
        isOffline: true,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(`room_${offlineRoomCode}`, JSON.stringify(roomData));
      return;
    }

    // Online mode - use existing socket logic, but show QR modal after creation
    setIsCreating(true);
    socket.emit("createRoom", username, (response) => {
      setIsCreating(false);
      if (response) {
        setGeneratedRoomCode(response);
        setShowQRCode(true);
        // Store room info in localStorage for possible future offline use
        const roomData = {
          roomCode: response,
          username: username,
          bubbleColor: bubbleColor,
          isOffline: false,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(`room_${response}`, JSON.stringify(roomData));
      }
    });
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCode.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter both username and room code',
        icon: 'warning'
      });
      return;
    }

    // Use unified maze animation function
    startMazeAnimation(roomCode.trim());
  };

  const handleScanQR = () => {
    if (!username.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter your username',
        icon: 'warning'
      });
      return;
    }
    setShowScanner(true);
  };

  const handleQRCodeScanned = (decodedText) => {
    console.log("handleQRCodeScanned called with:", decodedText);

    // Parse the scanned room code first
    const scannedRoomCode = decodedText.trim();
    console.log("Parsed room code:", scannedRoomCode);

    // Stop scanner immediately
    if (scanner) {
      try {
        scanner.clear();
      } catch (error) {
        console.log("Scanner clear error:", error);
      }
      setScanner(null);
    }
    setShowScanner(false);

    // Add a small delay to ensure scanner is fully closed
    setTimeout(() => {
      console.log("Starting maze animation after delay...");
      startMazeAnimation(scannedRoomCode);
    }, 100);
  };

  // Update handleJoinRoomFromQR to handle both online and offline QR modal
  const handleJoinRoomFromQR = () => {
    if (!username.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter your username',
        icon: 'warning'
      });
      return;
    }

    // Use unified maze animation function
    startMazeAnimation(generatedRoomCode);
  };

  const handleCloseQR = () => {
    setShowQRCode(false);
    setGeneratedRoomCode("");
  };

  const handleCloseScanner = () => {
    if (scanner) {
      const state = scanner.getState();
      if (state === 2) { // 2 = SCANNING state
        scanner.stop().then(() => {
          scanner.clear();
          setScanner(null);
        }).catch(err => {
          console.log("Error closing scanner:", err);
          setScanner(null);
        });
      } else {
        try {
          scanner.clear();
        } catch (err) {
          console.log("Error clearing scanner:", err);
        }
        setScanner(null);
      }
    }
    setShowScanner(false);
  };

  // Cleanup maze interval on unmount
  useEffect(() => {
    return () => {
      if (mazeInterval) {
        clearInterval(mazeInterval);
      }
    };
  }, [mazeInterval]);

  // Initialize QR scanner when showScanner becomes true
  useEffect(() => {
    if (showScanner && !scanner) {
      const html5QrCode = new Html5Qrcode("qr-reader");

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      // Start scanning with back camera (environment)
      html5QrCode.start(
        { facingMode: "environment" }, // Use back camera directly
        config,
        (decodedText) => {
          console.log("QR Code scanned:", decodedText);
          // Stop the scanner immediately when QR is detected
          html5QrCode.stop().then(() => {
            html5QrCode.clear();
            handleQRCodeScanned(decodedText);
          }).catch(err => {
            console.log("Error stopping scanner:", err);
            handleQRCodeScanned(decodedText);
          });
        },
        (errorMessage) => {
          // Handle scan errors silently
          // console.log("QR scan error:", errorMessage);
        }
      ).catch(err => {
        console.error("Error starting QR scanner:", err);
        Swal.fire({
          title: 'Camera Error',
          text: 'Could not access camera. Please check permissions.',
          icon: 'error'
        });
        setShowScanner(false);
      });

      setScanner(html5QrCode);
    }

    return () => {
      if (scanner) {
        // Check if scanner is actually running before trying to stop it
        const state = scanner.getState();
        if (state === 2) { // 2 = SCANNING state
          scanner.stop().then(() => {
            scanner.clear();
          }).catch(err => {
            console.log("Scanner cleanup error:", err);
          });
        } else {
          // Scanner not running, just clear it
          try {
            scanner.clear();
          } catch (err) {
            console.log("Scanner clear error:", err);
          }
        }
      }
    };
  }, [showScanner]);

  // Maze component
  const MazeAnimation = ({ progress }) => {
    const mazeSize = 15;
    const cellSize = 20;
    const mazeWidth = mazeSize * cellSize;
    const mazeHeight = mazeSize * cellSize;

    // Use the current maze path
    const path = currentMazePath.length > 0 ? currentMazePath : generateSingleMazePath();
    const pathLength = path.length;
    const currentStep = Math.floor((progress / 100) * pathLength);
    const currentPath = path.slice(0, currentStep + 1);

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{
          fontSize: '1.5rem',
          color: '#00b7eb',
          fontWeight: 'bold',
          marginBottom: '10px'
        }}>
          Navigating to Room...
        </div>

        <div style={{
          position: 'relative',
          width: mazeWidth,
          height: mazeHeight,
          border: '2px solid #00b7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'rgba(0, 0, 0, 0.9)'
        }}>
          {/* Maze grid */}
          {Array.from({ length: mazeSize }, (_, row) =>
            Array.from({ length: mazeSize }, (_, col) => (
              <div
                key={`${row}-${col}`}
                style={{
                  position: 'absolute',
                  left: col * cellSize,
                  top: row * cellSize,
                  width: cellSize,
                  height: cellSize,
                  border: '1px solid rgba(0, 183, 235, 0.2)',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)'
                }}
              />
            ))
          )}

          {/* Blue trail path animation */}
          {currentPath.map((point, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: point.x * cellSize + 2,
                top: point.y * cellSize + 2,
                width: cellSize - 4,
                height: cellSize - 4,
                backgroundColor: index === currentPath.length - 1 ? '#00ff00' : '#00b7eb',
                borderRadius: '2px',
                boxShadow: index === currentPath.length - 1
                  ? '0 0 10px #00ff00, 0 0 20px #00ff00'
                  : '0 0 5px #00b7eb, 0 0 10px #00b7eb',
                animation: index === currentPath.length - 1 ? 'pulse 0.5s infinite' : 'trailGlow 1s ease-in-out',
                zIndex: index === currentPath.length - 1 ? 10 : 5
              }}
            />
          ))}

          {/* Start point */}
          <div style={{
            position: 'absolute',
            left: 2,
            top: 2,
            width: cellSize - 4,
            height: cellSize - 4,
            backgroundColor: '#ff6b6b',
            borderRadius: '2px',
            boxShadow: '0 0 5px #ff6b6b, 0 0 10px #ff6b6b',
            zIndex: 15
          }} />

          {/* End point */}
          <div style={{
            position: 'absolute',
            left: (mazeSize - 1) * cellSize + 2,
            top: (mazeSize - 1) * cellSize + 2,
            width: cellSize - 4,
            height: cellSize - 4,
            backgroundColor: '#28a745',
            borderRadius: '2px',
            boxShadow: '0 0 5px #28a745, 0 0 10px #28a745',
            zIndex: 15
          }} />
        </div>

        <div style={{
          fontSize: '1rem',
          color: '#ccc',
          textAlign: 'center'
        }}>
          Progress: {Math.round(progress)}%
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: 'black',
    }}>
      {/* Back to Home Page button */}
      <button
        className="btn btn-light position-absolute"
        style={{ top: 20, left: 20, zIndex: 10, borderRadius: '50%', padding: '8px 12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        onClick={() => navigate('/Home')}
        title="Back to Home"
      >
        <span role="img" aria-label="Home">🏠</span>
      </button>

      {/* Online/Offline Status Indicator */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '16px',
        fontSize: '0.85rem',
        fontWeight: '600',
        background: isOnline ? 'rgba(0, 255, 0, 0.15)' : 'rgba(255, 0, 0, 0.15)',
        border: `1px solid ${isOnline ? '#00ff00' : '#ff0000'}`,
        color: isOnline ? '#00ff00' : '#ff0000',
        textShadow: `0 0 5px ${isOnline ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)'}`,
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isOnline ? '#00ff00' : '#ff0000',
          boxShadow: `0 0 8px ${isOnline ? '#00ff00' : '#ff0000'}`,
        }}></div>
        <span className="d-none d-sm-inline">{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      <Particles
        particleCount={400}
        particleSpread={4.2}
        speed={0.4}
        particleColors={["#00b7eb"]}
        moveParticlesOnHover={true}
        particleHoverFactor={1}
        alphaParticles={true}
        particleBaseSize={100}
        sizeRandomness={1}
        cameraDistance={20}
        disableRotation={false}
        className="custom-particles"
      />
      <div className="container d-flex flex-column justify-content-center align-items-center" style={{
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: 1,
        padding: '20px',
      }}>
        <div className="text-center" style={{ pointerEvents: 'auto', maxWidth: '500px', width: '100%' }}>
          <h1
            className="mb-4 text-white"
            style={{
              textShadow: '0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #00b7eb, 0 0 70px #00b7eb, 0 0 80px #00b7eb, 0 0 100px #00b7eb, 0 0 150px #00b7eb',
              animation: 'glow 3s ease-in-out infinite alternate'
            }}
          >
            Create/Join your own room
          </h1>
          <style>{`
            @keyframes glow {
              from { text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #00b7eb, 0 0 70px #00b7eb, 0 0 80px #00b7eb, 0 0 100px #00b7eb, 0 0 150px #00b7eb; }
              to { text-shadow: 0 0 20px #fff, 0 0 30px #ff4da6, 0 0 40px #ff4da6, 0 0 50px #ff4da6, 0 0 60px #ff4da6, 0 0 70px #ff4da6, 0 0 80px #ff4da6; }
            }
          `}</style>

          {/* Offline Mode Notice */}
          {!isOnline && (
            <div className="mb-4 p-3" style={{
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              borderRadius: '8px',
              color: '#ff6b6b',
              fontSize: '0.9rem'
            }}>
              <strong>Offline Mode:</strong> You're currently offline. Room will be created locally.
            </div>
          )}

          {/* Username Input */}
          <div className="mb-4">
            <input
              className="form-control"
              type="text"
              placeholder="Enter Your Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 0 10px rgba(0, 183, 235, 0.5)',
                padding: '12px 16px',
                fontSize: '1rem',
                pointerEvents: 'auto'
              }}
            />
          </div>

          {/* Color Picker */}
          <div className="mb-4 d-flex align-items-center justify-content-center">
            <label htmlFor="color-picker" className="text-white me-3" style={{ fontSize: '1rem' }}>Chat Color:</label>
            <input
              type="color"
              id="color-picker"
              className="form-control form-control-color"
              value={bubbleColor}
              onChange={(e) => setBubbleColor(e.target.value)}
              title="Choose your chat color"
              style={{
                pointerEvents: 'auto',
                width: '60px',
                height: '40px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 0 10px rgba(0, 183, 235, 0.5)',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Room Code Input */}
          <div className="mb-4">
            <input
              className="form-control"
              type="text"
              placeholder="Enter Room Code (Optional)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 0 10px rgba(0, 183, 235, 0.5)',
                padding: '12px 16px',
                fontSize: '1rem',
                pointerEvents: 'auto'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="d-flex flex-column gap-3" style={{ maxWidth: '300px', margin: '0 auto' }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerateQR}
              disabled={!username.trim() || isCreating}
              style={{
                background: 'linear-gradient(45deg, #00b7eb, #00d4ff)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 0 15px rgba(0, 183, 235, 0.5)',
                padding: '14px 24px',
                fontSize: '1.1rem',
                fontWeight: '600',
                pointerEvents: 'auto',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              {isCreating ? "Creating..." : "Generate QR"}
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleScanQR}
              disabled={!username.trim()}
              style={{
                background: 'linear-gradient(45deg, #6c757d, #495057)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 0 15px rgba(108, 117, 125, 0.5)',
                padding: '14px 24px',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: 'white',
                pointerEvents: 'auto',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              Scan QR
            </button>

            <button
              className="btn btn-success"
              onClick={handleJoinRoom}
              disabled={!username.trim() || !roomCode.trim()}
              style={{
                background: 'linear-gradient(45deg, #28a745, #20c997)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 0 15px rgba(40, 167, 69, 0.5)',
                padding: '14px 24px',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: 'white',
                pointerEvents: 'auto',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Modal for Room (now for both online and offline) */}
      {showQRCode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '30px',
            borderRadius: '15px',
            textAlign: 'center',
            maxWidth: '400px',
            width: '100%',
            border: '1px solid rgba(0, 183, 235, 0.3)',
            boxShadow: '0 0 20px rgba(0, 183, 235, 0.2)'
          }}>
            <h3 style={{ color: '#00b7eb', marginBottom: '20px' }}>Room Created!</h3>
            <p style={{ color: '#fff', marginBottom: '15px' }}>
              Room Code: <strong style={{ color: '#00b7eb' }}>{generatedRoomCode}</strong>
            </p>
            <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '25px' }}>
              Share this code or QR with others to join your room
            </p>
            {/* Real QR Code for the room code using QRCodeSVG */}
            <div style={{
              width: '200px',
              height: '200px',
              margin: '0 auto 20px auto',
              background: 'white',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: '#000',
              fontWeight: 'bold'
            }}>
              <QRCodeSVG value={generatedRoomCode || ''} size={180} bgColor="#fff" fgColor="#222" includeMargin={true} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleJoinRoomFromQR}
                style={{
                  background: 'rgba(0, 183, 235, 0.7)',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              >
                Join Room
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCloseQR}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small QR Scanner Modal */}
      {showScanner && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.95)',
            padding: '25px',
            borderRadius: '15px',
            textAlign: 'center',
            maxWidth: '350px',
            width: '100%',
            border: '2px solid rgba(0, 183, 235, 0.5)',
            boxShadow: '0 0 25px rgba(0, 183, 235, 0.3)'
          }}>
            <h3 style={{ color: '#00b7eb', marginBottom: '15px', fontSize: '1.3rem' }}>📷 Scan QR Code</h3>
            <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '20px' }}>
              Point your camera at a QR code
            </p>
            <div id="qr-reader" style={{
              width: '100%',
              marginBottom: '15px',
              borderRadius: '10px',
              overflow: 'hidden'
            }}></div>
            <button
              className="btn btn-secondary"
              onClick={handleCloseScanner}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Maze Animation */}
      {scanAnimation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'scanSuccess 0.5s ease-in-out'
        }}>
          <MazeAnimation progress={mazeProgress} />
          <style>{`
            @keyframes scanSuccess {
              0% { opacity: 0; transform: scale(0.5); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.7; transform: scale(1.1); }
            }
            @keyframes trailGlow {
              0% { opacity: 0.5; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.1); }
              100% { opacity: 0.8; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default ChatLanding;