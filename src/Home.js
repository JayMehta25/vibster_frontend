// Homepage.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Chatbot from "./Chatbot"; // Import the chatbot
import Galaxy from './components/Galaxy'; // Import the Galaxy background
import { useAuth } from './contexts/AuthContext';
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from 'sweetalert2';
import RotatingText from './components/RotatingText';
import Globe from 'react-globe.gl';

// Add at the top of the Homepage component
const INTERESTS = [
  'Technology', 'Music', 'Movies', 'Travel', 'Sports', 'Gaming', 'Art', 'Science', 'Books', 'Food', 'Fitness', 'Fashion', 'Photography', 'Business', 'Education', 'Health', 'Nature', 'History', 'Politics', 'Finance', 'Spirituality', 'Writing', 'DIY', 'Memes', 'Other'
];

// ---------- Typewriter Title Component ----------
function TypewriterTitle() {
  const [text, setText] = useState("");
  const fullText = "Vibester";
  const [index, setIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (index < fullText.length) {
      const timer = setTimeout(() => {
        setText((prev) => prev + fullText[index]);
        setIndex(index + 1);
      }, 150); // Adjust typing speed here
      return () => clearTimeout(timer);
    }
  }, [index, fullText]);

  return (
    <div className="navbar-title">
      {text}
      {index < fullText.length && <span className="cursor"></span>}
    </div>
  );
}

// ---------- Online Status Component ----------
function OnlineStatus({ isOnline }) {
  return (
    <div className="online-status" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '16px',
      fontSize: '0.85rem',
      fontWeight: '600',
      fontFamily: 'Rajdhani, sans-serif',
      transition: 'all 0.3s ease',
      background: isOnline ? 'rgba(0, 255, 0, 0.15)' : 'rgba(255, 0, 0, 0.15)',
      border: `1px solid ${isOnline ? '#00ff00' : '#ff0000'}`,
      color: isOnline ? '#00ff00' : '#ff0000',
      textShadow: `0 0 5px ${isOnline ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)'}`,
      animation: isOnline ? 'pulseOnline 2s infinite' : 'pulseOffline 2s infinite'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: isOnline ? '#00ff00' : '#ff0000',
        boxShadow: `0 0 8px ${isOnline ? '#00ff00' : '#ff0000'}`,
        animation: isOnline ? 'blinkOnline 1.5s infinite' : 'blinkOffline 1.5s infinite'
      }}></div>
      <span className="d-none d-sm-inline">{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  );
}

// ---------- Welcome Ticker Component ----------

// ---------- ChatBot Component ----------
function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text:
        "Hello! I'm ChatBot, your virtual assistant for ChatRouletteX. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const typeOutBotMessage = (fullText) => {
    let index = 0;
    let botReply = "";
    setMessages((prev) => [...prev, { sender: "bot", text: "" }]);
    const interval = setInterval(() => {
      if (index < fullText.length) {
        botReply += fullText[index];
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { sender: "bot", text: botReply };
          return newMessages;
        });
        index++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 50);
  };

  const handleSend = async () => {
    if (isTyping || input.trim() === "") return;
    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsTyping(true);

    try {
      // const response = await fetch("https://chatroulletexbackend-production-adb8.up.railway.app/api/chatbot", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ message: currentInput }),
      // });

      // if (!response.ok) {
      //   throw new Error("Network response was not ok");
      // }
      // const data = await response.json();

      // // Log the response to ensure correct data is received
      // console.log("ChatBot response:", data);

      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "ChatBot is thinking..." },
      ]);
      setTimeout(() => {
        setMessages((prev) => prev.slice(0, prev.length - 1)); // Remove the thinking message
        typeOutBotMessage(currentInput); // Update with the actual bot's reply
      }, 1000);
    } catch (error) {
      console.error("Error fetching chatbot response:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Sorry, an error occurred while processing your request.",
        },
      ]);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };


  return (
    <>
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <span>ChatBot</span>
            <button className="chatbot-close" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>
          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chatbot-message ${msg.sender}`}>
                {msg.sender === "bot" ? "🤖 " : "👤 "}
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="chatbot-message bot typing-indicator">
                🤖{" "}
                <span className="typing-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chatbot-input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="chatbot-input"
              disabled={isTyping}
            />
            <button
              className="chatbot-send"
              onClick={handleSend}
              disabled={isTyping}
            >
              Send
            </button>
          </div>
        </div>
      )}
      <button className="chatbot-toggle" onClick={() => setIsOpen(!isOpen)}>
        💬
      </button>
      {!isOpen && (
        <div className="chatbot-prompt">
          Need any help? I can do it for you now!
        </div>
      )}
    </>
  );
}

// ---------- Main Homepage Component ----------
export default function Homepage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const name = state?.name || localStorage.getItem('username') || '';
  const [scrollY, setScrollY] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [modalInterests, setModalInterests] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Ref for the scroll animation section
  const howItWorksRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: howItWorksRef,
    offset: ["start end", "end center"] // A balanced speed: ends when section center hits screen center
  });

  // Animate the text card sliding up
  const textCardY = useTransform(scrollYProgress, [0, 1], ["100%", "-40%"]);

  // Ref for the new interest-based chat section
  const interestChatRef = useRef(null);
  const { scrollYProgress: interestChatScrollProgress } = useScroll({
    target: interestChatRef,
    offset: ["start end", "end end"], // Animation ends when the section bottom hits the viewport bottom
  });
  const interestTextY = useTransform(interestChatScrollProgress, [0.3, 0.8], ["100%", "0%"]); // Animate from bottom to center, but finish animation earlier (at 80% scroll)

  // Globe ref for hero section
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  // Preload globe textures ASAP
  useEffect(() => {
    const img1 = new Image();
    const img2 = new Image();
    img1.src = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
    img2.src = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
    let loaded = 0;
    const onLoad = () => {
      loaded += 1;
      if (loaded === 2) {
        // Give the globe a tick to mount then mark ready if not already
        setTimeout(() => setGlobeReady(true), 0);
      }
    };
    img1.onload = onLoad; img2.onload = onLoad;
    return () => { img1.onload = null; img2.onload = null; };
  }, []);
  useEffect(() => {
    if (globeRef.current) {
      // Lower pixel ratio a bit to speed up first render
      try {
        const r = globeRef.current.renderer?.();
        if (r && r.setPixelRatio) {
          r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        }
      } catch { }
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 2.5;
      globeRef.current.controls().enableZoom = false; // Disable zoom
      // Adjust zoom level based on screen width
      const isMobile = windowWidth < 768;
      globeRef.current.camera().position.z = isMobile ? 350 : 200;
    }
  }, [windowWidth]);

  // If a name is passed from the tutorial, store it
  useEffect(() => {
    if (name) {
      localStorage.setItem("username", name);
    }
  }, [name]);

  // Update scrollY and windowWidth for dynamic styling
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Dynamic title style (moves from center to top)
  const titleStyle = {
    position: "fixed",
    top: scrollY > 100 ? "10%" : "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    transition: "all 0.5s ease",
    color: "#fff",
    fontFamily: "'Audiowide', cursive",
    fontSize: "5rem",
    fontWeight: "bold",
    textShadow: "0 0 10px #00d8ff, 0 0 20px #00d8ff, 0 0 30px #00d8ff",
    zIndex: 2,
    animation: "glow 1.5s ease-in-out infinite alternate",
  };

  // Functionalities info style with moving gradient text

  // Logout handler for navigation bar
  const handleLogout = () => {
    localStorage.removeItem("username");
    navigate("/");
  };

  // Handler for interest chip click
  const handleInterestClick = (interest) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      } else {
        return [...prev, interest];
      }
    });
    // Optionally, navigate to a random room for that interest
    // navigate(`/chatmain?interest=${interest}`);
  };

  // Handler for create room
  const handleCreateRoom = () => {
    // If user is authenticated, go straight to ChatLanding
    if (user) {
      navigate("/ChatLanding");
      return;
    }

    // If not authenticated, show the alert
    Swal.fire({
      title: 'ACCOUNT REQUIRED',
      text: 'Please sign in to access premium chat features.',
      icon: 'warning',
      background: 'rgba(10, 20, 30, 0.95)',
      color: '#fff',
      confirmButtonColor: '#00d8ff',
      showClass: {
        popup: 'animate__animated animate__rubberBand'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      },
      showConfirmButton: true
    }).then((result) => {
      if (result.isConfirmed) {
        navigate("/auth");
      }
    });
  };

  // Handler for join room
  const handleJoinRoom = () => {
    if (!user) {
      Swal.fire({
        title: 'ACCOUNT REQUIRED',
        text: 'Please sign in to access premium chat features.',
        icon: 'warning',
        background: 'rgba(10, 20, 30, 0.95)',
        color: '#fff',
        confirmButtonColor: '#00d8ff',
        showClass: {
          popup: 'animate__animated animate__rubberBand'
        },
        hideClass: {
          popup: 'animate__animated animate__fadeOutUp'
        },
        showConfirmButton: true
      }).then((result) => {
        if (result.isConfirmed) {
          navigate("/auth");
        }
      });
      return;
    }
    if (roomCodeInput.trim()) {
      navigate("/chatmain", { state: { roomCode: roomCodeInput.trim(), interest: selectedInterests.join(',') } });
    }
  };

  // "Engage" button handler
  const handleEngage = async () => {
    if (selectedInterests.length === 0) {
      Swal.fire({
        title: 'Select an Interest',
        text: 'Please select at least one interest to start chatting.',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }

    let username = localStorage.getItem("username");
    if (!username) {
      const { value: inputName } = await Swal.fire({
        title: 'Enter your username',
        input: 'text',
        inputLabel: 'Username',
        inputPlaceholder: 'Type your name here',
        confirmButtonColor: '#00d8ff',
        background: 'rgba(10, 20, 30, 0.95)',
        color: '#00d8ff',
        showCancelButton: true,
        cancelButtonColor: '#ff4d4d',
        inputValidator: (value) => {
          if (!value) {
            return 'A username is required!';
          }
        }
      });

      if (inputName) {
        username = inputName;
        localStorage.setItem("username", username);
      } else {
        return; // User cancelled the prompt
      }
    }

    navigate("/interest-chat", {
      state: {
        username: username,
        interests: selectedInterests,
      },
    });
  };

  // Handler for About Us button with animation
  const handleAboutUs = () => {
    navigate("/about");
  };

  const handleStartConnecting = () => {
    setShowInterestModal(true);
  };

  const handleRandomMatch = async () => {
    let username = localStorage.getItem("username");
    if (!username || username.startsWith("Guest")) {
      const { value: inputName } = await Swal.fire({
        title: 'Enter your username',
        input: 'text',
        inputLabel: 'Username',
        inputPlaceholder: 'Type your name here',
        confirmButtonColor: '#00d8ff',
        background: 'rgba(10, 20, 30, 0.95)',
        color: '#00d8ff',
        showCancelButton: true,
        cancelButtonColor: '#ff4d4d',
        inputValidator: (value) => {
          if (!value) {
            return 'A username is required!';
          }
        }
      });

      if (inputName) {
        username = inputName;
        localStorage.setItem("username", username);
      } else {
        return; // User cancelled
      }
    }
    navigate("/interest-chat", {
      state: {
        username: username,
        interests: ['random'],
        isRandom: true
      },
    });
  };

  const toggleModalInterest = (interest) => {
    setModalInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleContinueFromModal = async () => {
    if (modalInterests.length === 0) {
      alert('Please select at least one interest!');
      return;
    }
    let username = localStorage.getItem("username");
    if (!username || username.startsWith("Guest")) {
      username = window.prompt("Please enter your name to continue:");
      if (!username || !username.trim()) {
        alert('A name is required to continue!');
        return;
      }
      localStorage.setItem("username", username.trim());
      username = username.trim();
    }
    setShowInterestModal(false);
    setSelectedInterests(modalInterests);
    navigate("/interest-chat", {
      state: {
        username: username,
        interests: modalInterests,
      },
    });
  };

  // Effect to monitor network status
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

  return (
    <>
      {/* Global and Component Styles */}
      <style>
        {`
          /* Google Fonts Import */
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&family=Bebas+Neue&family=Quicksand:wght@300;400;500;600;700&family=Montserrat:wght@400;500;600;700;800&family=Poppins:wght@300;400;500;600;700&family=Righteous&family=Open+Sans:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap');

          /* Hide scrollbar for Chrome, Safari and Opera */
          ::-webkit-scrollbar {
            width: 0px;
            background: transparent;
          }
          /* Hide scrollbar for IE, Edge and Firefox */
          body, .layout-container, .main-console {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none;  /* IE and Edge */
          }
          body::-webkit-scrollbar, .layout-container::-webkit-scrollbar, .main-console::-webkit-scrollbar {
            display: none;
          }

          /* Keyframes for background and gradient animations */
          @keyframes gradientAnimation {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes bgAnimation {
            0% { background-position: 0% 0%; }
            50% { background-position: 100% 100%; }
            100% { background-position: 0% 0%; }
          }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
          @keyframes gradientShift {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
          @keyframes floatUpDown {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
          }
          @keyframes promptSlide {
            0% { transform: translateX(0); opacity: 1; }
            50% { transform: translateX(10px); opacity: 0.8; }
            100% { transform: translateX(0); opacity: 1; }
          }
          @keyframes glow {
            from {
              text-shadow: 0 0 10px #00d8ff, 0 0 20px #00d8ff, 0 0 30px #00d8ff;
            }
            to {
              text-shadow: 0 0 20px #00d8ff, 0 0 30px #ff00de, 0 0 40px #ff00de;
            }
          }

          /* Online/Offline Status Animations */
          @keyframes pulseOnline {
            0%, 100% { 
              box-shadow: 0 0 5px rgba(0, 255, 0, 0.3), 0 0 10px rgba(0, 255, 0, 0.2); 
            }
            50% { 
              box-shadow: 0 0 10px rgba(0, 255, 0, 0.5), 0 0 20px rgba(0, 255, 0, 0.3); 
            }
          }

          @keyframes pulseOffline {
            0%, 100% { 
              box-shadow: 0 0 5px rgba(255, 0, 0, 0.3), 0 0 10px rgba(255, 0, 0, 0.2); 
            }
            50% { 
              box-shadow: 0 0 10px rgba(255, 0, 0, 0.5), 0 0 20px rgba(255, 0, 0, 0.3); 
            }
          }

          @keyframes blinkOnline {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.2); }
          }

          @keyframes blinkOffline {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
          }

          /* Global Styles */
          body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #000; /* Fallback background */
          }
          
          /* Particles Background */
          .particles-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 0; /* Behind other content */
          }
          
          /* Main Layout Container */
          .layout-container {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            width: 100vw;
            align-items: center;
            justify-content: flex-start;
            position: relative;
            z-index: 1;
            padding: 0;
            box-sizing: border-box;
            padding-top: 70px; /* Height of navbar */
            padding-bottom: 70px; /* Height of footer */
            overflow-y: auto;
          }

          /* Navigation Bar */
          .navbar {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(5px);
            padding: 15px 30px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            transition: top 0.3s ease;
          }

          .navbar .container-fluid {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 0;
          }

          .navbar-left {
            display: flex;
            align-items: center;
            gap: 5px;
          }
          
          .navbar-title {
            font-family: 'Orbitron', monospace;
            font-size: 2rem;
            color: #fff;
            text-shadow: 0 0 5px #00d8ff, 0 0 10px #00d8ff;
            font-weight: 700;
            letter-spacing: 2px;
            white-space: nowrap;
            margin-right:70px;
          }
          .cursor {
            display: inline-block;
            width: 3px;
            height: 1.2em;
            background: #00b7ff;
            animation: blink 1s infinite;
            vertical-align: middle;
          }
          
          .navbar-links {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: nowrap;
          }

          .nav-button {
            padding: 10px 20px;
            font-size: 1rem;
            background-color: transparent;
            color: #00d8ff;
            border: 2px solid #00d8ff;
            border-radius: 25px;
            cursor: pointer;
            margin-left: 0;
            transition: all 0.3s ease;
            font-weight: bold;
            text-shadow: 0 0 5px rgba(0, 216, 255, 0.7);
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            letter-spacing: 1px;
          }
          .nav-button:hover {
            background-color: #00d8ff;
            color: #000;
            box-shadow: 0 0 15px #00d8ff, 0 0 25px #00d8ff;
          }
          .logout-button {
            border-color: #ff00de;
            color: #ff00de;
            text-shadow: 0 0 5px rgba(255, 0, 222, 0.7);
          }
          .logout-button:hover {
            background-color: #ff00de;
            color: #fff;
            box-shadow: 0 0 15px #ff00de, 0 0 25px #ff00de;
          }

          /* Mobile Navigation */
          .mobile-nav-right {
            display: none;
            align-items: center;
            gap: 15px;
            margin-left: auto;
          }

          .mobile-signin {
            margin-left: 0 !important;
          }

          /* Hamburger Menu Icon */
          .hamburger-menu {
            background: transparent;
            border: none;
            cursor: pointer;
            display: none; /* Hidden on desktop */
            flex-direction: column;
            gap: 5px;
            padding: 8px;
            z-index: 1001;
            margin-left: 10px;
          }

          .hamburger-menu span {
            width: 25px;
            height: 3px;
            background: #00d8ff;
            border-radius: 3px;
            transition: all 0.3s ease;
            box-shadow: 0 0 5px rgba(0, 216, 255, 0.7);
          }

          .hamburger-menu.open span:nth-child(1) {
            transform: rotate(45deg) translate(8px, 8px);
          }

          .hamburger-menu.open span:nth-child(2) {
            opacity: 0;
          }

          .hamburger-menu.open span:nth-child(3) {
            transform: rotate(-45deg) translate(7px, -7px);
          }

          /* Mobile Dropdown Menu */
          .mobile-dropdown {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: rgba(10, 20, 30, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 183, 235, 0.3);
            border-radius: 15px;
            padding: 20px;
            width: 90%;
            max-width: 300px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            z-index: 999;
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s ease;
            box-shadow: 0 0 40px rgba(0, 183, 235, 0.3);
          }

          .mobile-dropdown.show {
            opacity: 1;
            pointer-events: all;
            transform: translateX(-50%) translateY(0);
          }

          .mobile-menu-item {
            background: transparent;
            color: #00d8ff;
            border: 2px solid #00d8ff;
            border-radius: 25px;
            padding: 12px 20px;
            font-size: 1rem;
            font-weight: 600;
            font-family: 'Rajdhani', sans-serif;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-shadow: 0 0 5px rgba(0, 216, 255, 0.7);
          }

          .mobile-menu-item:hover {
            background-color: #00d8ff;
            color: #000;
            box-shadow: 0 0 15px #00d8ff;
          }

          .mobile-menu-item.logout {
            border-color: #ff00de;
            color: #ff00de;
            text-shadow: 0 0 5px rgba(255, 0, 222, 0.7);
          }

          .mobile-menu-item.logout:hover {
            background-color: #ff00de;
            color: #fff;
            box-shadow: 0 0 15px #ff00de;
          }

          /* Responsive Styles */
          @media (max-width: 768px) {
            .desktop-only {
              display: none !important;
            }

            .mobile-nav-right {
              display: flex !important;
            }

            .navbar {
              padding: 10px 15px;
            }

            .navbar .container-fluid {
              padding: 0;
              margin: 0;
            }

            .navbar-left {
              gap: 15px;
              margin-left: 0;
              padding-left: 0;
            }

            .hamburger-menu {
              display: flex !important; /* Show on mobile */
            }

            .navbar-title {
              font-size: 1.2rem;
              margin-left: 0;
              letter-spacing: 1px;
            }

            .nav-button {
              padding: 6px 12px;
              font-size: 0.85rem;
            }

            .hamburger-menu {
              padding: 5px;
              margin-left: 8px;
            }

            .hamburger-menu span {
              width: 22px;
              height: 2.5px;
            }
          }

          /* Main Content Card */
          .main-console {
            background: rgba(10, 20, 30, 0.15);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 183, 255, 0.3);
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 700px;
            text-align: center;
            color: #fff;
            box-shadow: 0 0 40px rgba(0, 183, 255, 0.2), inset 0 0 20px rgba(0, 183, 255, 0.1);
            animation: floatUpDown 4s infinite alternate ease-in-out;
            display: flex;
            flex-direction: column;
            gap: 25px;
            margin-bottom: 40px;
            margin-top: 20px;
          }

          .console-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #00b7ff;
            text-shadow: 0 0 10px #00b7ff;
            margin: 0;
            font-family: 'Bebas Neue', cursive;
            letter-spacing: 3px;
            text-transform: uppercase;
          }

          .console-p {
            font-size: 1.1rem;
            color: #ccc;
            line-height: 1.6;
            margin: 0;
            font-family: 'Quicksand', sans-serif;
            font-weight: 500;
          }

          .interest-label {
            font-weight: 600;
            color: #00b7ff;
            font-size: 1.2rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-family: 'Montserrat', sans-serif;
            font-weight: 700;
          }

          .chip-group {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
          }

          .chip {
            background: rgba(0, 183, 255, 0.1);
            color: #00b7ff;
            border: 1px solid #00b7ff;
            border-radius: 20px;
            padding: 10px 20px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
          }

          .chip.selected, .chip:hover {
            background: #00b7ff;
            color: #000;
            transform: scale(1.05);
            box-shadow: 0 0 15px #00b7ff;
          }

          .engage-button {
            background: linear-gradient(90deg, #8E2DE2, #4A00E0);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            border: none;
            font-size: 1.2rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease-in-out;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            position: relative;
            overflow: hidden;
            z-index: 1;
            font-family: 'Righteous', cursive;
            letter-spacing: 1px;
          }

          .engage-button:before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: all 0.6s ease-in-out;
            z-index: -1;
          }

          .engage-button:hover:before {
            left: 100%;
          }

          .engage-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(74, 0, 224, 0.4);
          }

          .start-networking-btn {
            background: linear-gradient(45deg, #00b7ff, #00d4ff);
            color: #000;
            border: none;
            border-radius: 25px;
            padding: 15px 30px;
            font-size: 1.2rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 0 20px #00b7ff;
          }
          .start-networking-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 0 30px #00b7ff;
          }

          /* Footer Section */
          .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100vw;
            z-index: 1000;
            padding: 15px 30px;
            text-align: center;
            color: #888;
            font-size: 0.9rem;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(5px);
            font-family: 'Open Sans', sans-serif;
          }
          
          .footer-links a {
            color: #00b7ff;
            text-decoration: none;
            margin: 0 10px;
            transition: color 0.3s;
            font-family: 'Roboto', sans-serif;
            font-weight: 500;
          }
          .footer-links a:hover {
             text-decoration: underline;
             color: #fff;
          }

          .navbar-links {
            display: flex;
            gap: 24px;
            justify-content: center;
            align-items: center;
            width: 100%;
            margin-right: 160px;
          }

          .navbar-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          @media (max-width: 768px) {
            .navbar {
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 10px 0;
              height: auto;
            }
            .navbar-left {
              margin: 0 0 10px 0;
              flex-shrink: 0;
              width: 100%;
              display: flex;
              justify-content: center;
              padding-left: 0;
              gap: 12px;
            }
            .online-status {
              font-size: 0.75rem !important;
              padding: 4px 8px !important;
            }
          }
            .navbar-links {
              flex-direction: row;
              justify-content: center;
              align-items: center;
              gap: 6px;
              width: 100%;
              margin: 0;
            }
            .nav-button {
              padding: 3px 10px;
              font-size: 0.85rem;
              margin: 0 2px;
              min-width: 70px;
              border-radius: 20px;
            }
            .logout-button {
              min-width: 32px;
              padding: 3px 0;
              margin-left: 2px;
            }
          }

          @media (min-width: 769px) {
            .navbar {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              padding: 15px 30px;
            }
            .navbar-title {
              font-size: 2.5rem;
            }
            .console-title {
              text-align: center;
              margin: 0 auto 20px auto;
            }
            
            .navbar-links {
              gap: 24px;
            }
          }

          .about-anim {
            animation: aboutPageBlowMind 0.9s cubic-bezier(.77,0,.18,1) forwards;
          }
          @keyframes aboutPageBlowMind {
            0% {
              opacity: 1;
              transform: scale(1) rotate(0deg);
              filter: blur(0px) brightness(1);
            }
            40% {
              opacity: 0.7;
              transform: scale(1.08) rotate(3deg);
              filter: blur(2px) brightness(1.2);
            }
            70% {
              opacity: 0.3;
              transform: scale(0.92) rotate(-2deg);
              filter: blur(8px) brightness(1.5);
            }
            100% {
              opacity: 0;
              transform: scale(1.2) rotate(8deg);
              filter: blur(24px) brightness(2.2);
            }
          }

          /* Unique Home Main Section */
          .home-main-section {
            width: 100vw;
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 60px;
            padding-bottom: 40px;
            position: relative;
            z-index: 2;
          }

          .glow-title {
            font-size: 2.8rem;
            font-family: 'Bebas Neue', cursive;
            color: #00b7ff;
            text-shadow: none;
            background: linear-gradient(90deg, #00b7ff 0%, #00e0ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-fill-color: transparent;
            letter-spacing: 4px;
            margin-bottom: 10px;
            margin-top: 0;
            text-align: center;
            text-transform: uppercase;
            font-weight: 700;
            border-bottom: 2.5px solid #00b7ff33;
            display: inline-block;
            padding-bottom: 4px;
          }

          .home-description {
            font-size: 1.08rem;
            color: #b2eaff;
            font-family: 'Quicksand', sans-serif;
            margin-bottom: 18px;
            margin-top: 2px;
            text-align: center;
            letter-spacing: 0.5px;
            opacity: 0.85;
            text-shadow: 0 0 4px #00b7ff33;
          }

          .glow-separator {
            width: 220px;
            height: 4px;
            border-radius: 2px;
            background: linear-gradient(90deg, #00d8ff 0%, #fff 50%, #00d8ff 100%);
            box-shadow: 0 0 18px #00d8ff99, 0 0 32px #00b7ff55;
            margin: 0 auto 32px auto;
            opacity: 0.7;
          }

          .interest-label {
            font-weight: 700;
            color: #fff;
            font-size: 1.3rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-family: 'Montserrat', sans-serif;
            margin-bottom: 18px;
            text-shadow: 0 0 8px #00b7ff99;
          }

          .chip-group {
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            justify-content: center;
            margin-bottom: 32px;
          }

          .chip {
            background: rgba(0, 183, 255, 0.13);
            color: #00b7ff;
            border: 1.5px solid #00d8ff;
            border-radius: 22px;
            padding: 12px 26px;
            font-size: 1.08rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(.77,0,.18,1);
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            box-shadow: 0 0 12px #00d8ff33;
            backdrop-filter: blur(2px);
          }

          .chip.selected, .chip:hover {
            background: #00d8ff;
            color: #000;
            transform: scale(1.08);
            box-shadow: 0 0 18px #00d8ff;
          }

          .engage-button {
            background: linear-gradient(90deg, #8E2DE2, #4A00E0);
            color: white;
            padding: 18px 44px;
            border-radius: 50px;
            border: none;
            font-size: 1.25rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(.77,0,.18,1);
            box-shadow: 0 5px 22px rgba(0,0,0,0.22), 0 0 18px #4A00E099;
            position: relative;
            overflow: hidden;
            z-index: 1;
            font-family: 'Righteous', cursive;
            letter-spacing: 1px;
            margin-top: 18px;
          }
          .engage-button:before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: all 0.6s cubic-bezier(.77,0,.18,1);
            z-index: -1;
          }
          .engage-button:hover:before {
            left: 100%;
          }
          .engage-button:hover {
            transform: translateY(-3px) scale(1.04);
            box-shadow: 0 8px 28px rgba(74, 0, 224, 0.32);
          }

          /* Connect static box and rotating feature text */
          .connect-static-box {
            background: #0099ff;
            color: #fff;
            font-size: 1.45rem;
            font-weight: 700;
            border-radius: 12px;
            padding: 10px 26px;
            font-family: 'Montserrat', sans-serif;
            box-shadow: 0 2px 12px #0099ff33;
            letter-spacing: 1px;
            margin-right: 8px;
            display: flex;
            align-items: center;
          }
          .rotating-feature-text {
            font-size: 2.1rem;
            font-weight: 800;
            color: #00b7ff;
            font-family: 'Bebas Neue', cursive;
            letter-spacing: 2px;
            display: flex;
            align-items: center;
            min-width: 160px;
          }

          .connect-plain-text {
            color: #fff;
            font-size: 2.1rem;
            font-family: 'Bebas Neue', cursive;
            font-weight: 800;
            letter-spacing: 2px;
            display: flex;
            align-items: center;
            margin-right: 8px;
          }
          .rotating-feature-box {
            background: #0099ff;
            color: #fff;
            font-size: 1.45rem;
            font-weight: 700;
            border-radius: 12px;
            padding: 10px 26px;
            font-family: 'Montserrat', sans-serif;
            box-shadow: 0 2px 12px #0099ff33;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            min-width: 210px;
            width: 210px;
            justify-content: center;
            text-align: center;
          }

          /* Hero Section Background Styles */
          .hero-section-bg {
            position: relative;
            width: 100vw;
            min-height: 60vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 60px 0 40px 0;
            z-index: 2;
            overflow: hidden;
          }
          .hero-globe-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
          }
          .hero-bg-overlay {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,183,255,0.08) 100%);
            z-index: 1;
            pointer-events: none;
          }
          .hero-bg-content {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
            padding: 32px 16px;
          }
          @media (max-width: 900px) {
            .hero-bg-content {
              max-width: 98vw;
              padding: 24px 4vw;
            }
          }

          .interests-section {
            margin-top: 48px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100vw;
          }

          .hero-static-headline {
            font-size: 2.6rem;
            font-family: 'Bebas Neue', cursive;
            color: #00b7ff;
            font-weight: 900;
            letter-spacing: 3px;
            text-align: center;
            margin-bottom: 12px;
          }
          .hero-rotating-subheadline {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 18px;
          }
          .rotating-subheadline-box {
            background: #0099ff;
            color: #fff;
            font-size: 1.5rem;
            font-weight: 700;
            border-radius: 12px;
            padding: 10px 32px;
            font-family: 'Montserrat', sans-serif;
            box-shadow: 0 2px 12px #0099ff33;
            letter-spacing: 1px;
            min-width: 180px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          /* How It Works Section - MNC/Corporate Design with Scroll Animation */
          .how-it-works-section {
            width: 100%;
            height: 120vh; /* Taller section to allow for scroll animation */
            position: relative;
            background: #0A0F1A;
            overflow: hidden; /* Important for positioning */
            z-index: 3; /* Ensure it's on top of the next section */
          }

          .how-it-works-sticky-container {
            position: sticky;
            top: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .how-it-works-image-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }

          .how-it-works-image-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.4); /* Darkened for better text contrast */
          }

          .how-it-works-text-container {
            /* Now an absolute overlay, but will be transformed */
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            padding: 40px 8%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: transparent;
          }

          .how-it-works-title {
            font-family: 'Bebas Neue', cursive;
            font-size: 3.5rem;
            color: #fff;
            line-height: 1.1;
            margin-bottom: 20px;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
          }
          .how-it-works-title .highlight {
            color: #00d8ff;
            text-shadow: 0 0 15px #00d8ff;
          }

          .how-it-works-description {
            font-size: 1.1rem;
            line-height: 1.7;
            color: #a9cce3;
            margin-bottom: 40px;
            font-family: 'Quicksand', sans-serif;
            max-width: 500px;
          }

          .feature-grid {
            display: grid;
            grid-template-columns: 1fr; /* Single column for features */
            gap: 25px;
          }

          .feature-item {
            display: flex;
            align-items: flex-start;
            gap: 20px;
          }

          .feature-icon {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            color: #00d8ff;
          }

          .feature-text h4 {
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 1.25rem;
            margin: 0 0 5px 0;
            color: #fff;
          }

          .feature-text p {
            margin: 0;
            color: #a9cce3;
            font-family: 'Quicksand', sans-serif;
            font-size: 0.95rem;
          }

          @media (max-width: 1200px) {
            .how-it-works-text-container {
              padding: 50px;
            }
          }

          @media (max-width: 992px) {
            .how-it-works-section {
              flex-direction: column;
              padding-bottom: 40px; /* Add padding at the bottom */
            }
            .how-it-works-image-container {
              clip-path: none;
              flex-basis: 350px; /* Give image a fixed, taller height on mobile */
              width: 100%;
            }
            .how-it-works-text-container {
              padding: 40px 30px;
              text-align: center;
              margin: -80px 20px 0 20px; /* Pull up over the image with side margins */
              position: relative; /* Establish stacking context */
              background: transparent; /* Make background transparent on mobile */
              border: none; /* Remove border on mobile */
              width: auto; /* Allow container to shrink with margins */
            }
            .feature-item {
              flex-direction: column;
              align-items: center;
              text-align: center;
              gap: 10px;
            }
          }

          /* New styles for the third section */
          .find-people-section {
            position: relative;
            width: 100%;
            height: 80vh; /* Adjust height as needed */
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            overflow: hidden;
          }
          .find-people-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.6);
          }
          .find-people-overlay {
            position: absolute;
            color: #fff;
          }
          .find-people-title {
            font-family: 'Bebas Neue', cursive;
            font-size: 4rem;
            color: #fff;
            text-shadow: 0 0 20px rgba(0, 0, 0, 0.7);
            margin-bottom: 20px;
          }

          /* Updated styles for the interest chat section */
          .interest-chat-section {
            width: 100%;
            height: 120vh; /* Shortened for a tighter scroll effect */
            position: relative;
            background: #0A0F1A;
            overflow: hidden;
            margin-top: -20vh; /* Pull the section up to overlap */
            z-index: 2; /* Position it behind the previous section */
          }
          .interest-chat-sticky-container {
            position: sticky;
            top: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .interest-chat-image-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .interest-chat-image-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.6);
          }
          .interest-chat-text-container {
            position: absolute;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: #fff;
            padding: 40px;
            max-width: 600px;
          }
          .interest-chat-title {
            font-family: 'Bebas Neue', cursive;
            font-size: 3.5rem;
            margin-bottom: 20px;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
          }
          .interest-chat-description {
            font-size: 1.1rem;
            line-height: 1.7;
            color: #a9cce3;
            margin-bottom: 40px;
            font-family: 'Quicksand', sans-serif;
          }
        `}
      </style>

      <div className="layout-container">
        <div className="particles-background">
          <Galaxy
            mouseRepulsion={true}
            mouseInteraction={true}
            density={0.3}
            glowIntensity={0.5}
            saturation={0.0}
            hueShift={0}
          />
        </div>
        {/* ---------- Navigation Bar ---------- */}
        <nav className="navbar navbar-expand-lg">
          <div className="container-fluid">
            <div className="navbar-left">
              <TypewriterTitle />
              <OnlineStatus isOnline={isOnline} />
              {/* Mobile: Hamburger Menu */}
              <button
                className={`hamburger-menu ${mobileMenuOpen ? 'open' : ''}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>

            <div className="navbar-links desktop-only">
              <button className="nav-button" onClick={() => navigate('/features')}>
                Features
              </button>
              <button className="nav-button" onClick={handleAboutUs}>About Us</button>
              <button className="nav-button" onClick={handleCreateRoom}>
                Create Room
              </button>
              <button className="nav-button" onClick={() => navigate("/auth")}>
                Sign In
              </button>
              <button className="logout-button" onClick={handleLogout} title="Logout">
                🚪
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        <div className={`mobile-dropdown ${mobileMenuOpen ? 'show' : ''}`}>
          <button className="mobile-menu-item" onClick={() => { navigate('/features'); setMobileMenuOpen(false); }}>
            Features
          </button>
          <button className="mobile-menu-item" onClick={() => { handleAboutUs(); setMobileMenuOpen(false); }}>
            About Us
          </button>
          <button className="mobile-menu-item" onClick={() => { handleCreateRoom(); setMobileMenuOpen(false); }}>
            Create Room
          </button>
          <button className="mobile-menu-item" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
            Sign In
          </button>
          <button className="mobile-menu-item logout" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
            Logout 🚪
          </button>
        </div>

        {/* ---------- Modern Hero Section ---------- */}
        <section className="hero-section-bg">
          <div className="hero-bg-overlay"></div>
          <div className="hero-globe-container">
            <Globe
              ref={globeRef}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              width={undefined}
              height={undefined}
              backgroundColor="rgba(0,0,0,0)"
              devicePixelRatio={Math.min(window.devicePixelRatio || 1, 1.5)}
              onGlobeReady={() => setGlobeReady(true)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', filter: 'brightness(1.15)' }}
            />
            {!globeReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'radial-gradient(ellipse at center, rgba(0,80,120,0.25), rgba(0,0,0,0))' }}>
                <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(90deg, rgba(155,211,255,0.2) 25%, rgba(155,211,255,0.5) 50%, rgba(155,211,255,0.2) 75%)', animation: 'globeShimmer 1.2s infinite', filter: 'blur(0.2px)' }} />
                <style>{`@keyframes globeShimmer{0%{background-position:-150px 0}100%{background-position:150px 0}}`}</style>
              </div>
            )}
          </div>
          <div className="hero-bg-content">
            <div className="hero-static-headline">Meet. Match. Vibe.</div>
            <div className="hero-rotating-subheadline">
              <RotatingText
                texts={[
                  'Instantly',
                  'Securely',
                  'By Interests',
                  'With Friends',
                  'Anonymously',
                  'Globally',
                  'Effortlessly',
                ]}
                mainClassName="rotating-subheadline-box"
                staggerFrom={"last"}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-120%" }}
                staggerDuration={0.025}
                splitLevelClassName="overflow-hidden pb-1"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                rotationInterval={2000}
              />
            </div>
            <div className="home-description">Meet new people, share ideas, and vibe together!</div>
          </div>
        </section>

        {/* ---------- How It Works Section ---------- */}
        <section ref={howItWorksRef} className="how-it-works-section">
          <div className="how-it-works-sticky-container">
            <div className="how-it-works-image-container">
              <img src="https://img.huffingtonpost.com/asset/5e7b856d240000660bcea485.jpeg?cache=o7bvEgPrzP&ops=1778_1000" alt="Friends chatting and having fun" />
            </div>
            <motion.div
              className="how-it-works-text-container"
              style={{ y: textCardY }}
              transition={{ type: "spring", stiffness: 40, damping: 30, mass: 1.2 }}
            >
              <h2 className="how-it-works-title">BREAK THE ICE, <span className="highlight">INSTANTLY.</span></h2>
              <p className="how-it-works-description">Tired of awkward silences? Vibester connects you with people who share your passions. Dive into conversations that matter, share ideas, and find your crew—no strings attached.</p>
              <div className="feature-grid">
                <div className="feature-item">
                  <svg className="feature-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="feature-text">
                    <h4>Connect by Interests</h4>
                    <p>From 'Tech' to 'Travel', pick your vibe and get matched with the right people.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <svg className="feature-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div className="feature-text">
                    <h4>Safe & Anonymous</h4>
                    <p>Chat freely without sharing personal details. Your privacy is our priority.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <svg className="feature-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div className="feature-text">
                    <h4>Instant Rooms</h4>
                    <p>No waiting around. Create a private room or join an existing one in seconds.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ---------- Third Section: Interest-Based Chat ---------- */}
        <section ref={interestChatRef} className="interest-chat-section">
          <div className="interest-chat-sticky-container">
            <div className="interest-chat-image-container">
              <img
                src="https://www.upthereeverywhere.com/hs-fs/hubfs/2023_Blog/Kate_LikeMinded_Blog.jpg?width=1416&height=894&name=Kate_LikeMinded_Blog.jpg"
                alt="Interest based chat"
              />
            </div>
            <motion.div
              className="interest-chat-text-container"
              style={{ y: interestTextY }}
            >
              <h2 className="interest-chat-title">Connect on What You Love</h2>
              <p className="interest-chat-description">
                Don't just talk, connect. Vibester's interest-based matching lets you skip the small talk and dive deep into conversations that excite you. Whether it's the latest in tech, a passion for travel, or a love for classic movies, you'll find someone who gets it.
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="engage-button" onClick={handleStartConnecting}>Start Connecting</button>
                <button className="engage-button" onClick={handleRandomMatch} style={{ background: 'linear-gradient(90deg, #ff00de, #b700ff)', boxShadow: '0 0 18px #ff00de99' }}>
                  Surprise Me 🎲
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ---------- Footer ---------- */}
        <footer className="page-footer" style={{ padding: '10px 0', fontSize: '0.95em', background: '#101c2c', color: '#aaa', borderTop: '1px solid #222', marginTop: 32 }}>
          <div className="container-fluid">
            <div className="row">
              <div className="col-12">
                <div className="footer-links" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.98em', padding: '2px 0' }}>
                  <a href="mailto:support@vibester.com">Support</a>
                  <span>|</span>
                  <a href="#how-it-works" onClick={(e) => { e.preventDefault(); alert("How it works: 1. Enter or create a room code. 2. Select your interest. 3. Chat privately and securely with random people. 4. Add friends after chatting!"); }}>How it Works</a>
                  <span>|</span>
                  <a href="/about" style={{ color: '#00b7ff', textDecoration: 'none' }}>About Us</a>
                  <span>|</span>
                  <a href="/privacy" style={{ color: '#00b7ff', textDecoration: 'none' }}>Privacy Policy</a>
                  <span>|</span>
                  <a href="mailto:support@vibester.com" style={{ color: '#00b7ff', textDecoration: 'none' }}>Contact</a>
                </div>
                <p style={{ margin: '6px 0 0 0', opacity: 0.7, fontSize: '0.88em', textAlign: 'center' }}>&copy; {new Date().getFullYear()} Vibester. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
      <Chatbot />
      {showInterestModal && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(10,20,40,0.85)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transition: 'all 0.3s',
        }}>
          <div style={{
            width: '100%', maxWidth: 500, background: '#101c2c', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 32, boxShadow: '0 -8px 32px #0008', animation: 'slideUpModal 0.4s cubic-bezier(.77,0,.18,1)',
          }}>
            <h2 style={{ marginBottom: 24, color: '#00b7ff' }}>Select Your Interests</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
              {INTERESTS.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleModalInterest(interest)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 20,
                    border: modalInterests.includes(interest) ? '2px solid #00b7ff' : '2px solid #444',
                    background: modalInterests.includes(interest) ? '#00b7ff' : 'transparent',
                    color: modalInterests.includes(interest) ? '#000' : '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none',
                  }}
                >
                  {interest}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <button onClick={() => setShowInterestModal(false)} style={{ padding: '10px 28px', borderRadius: 20, background: '#222', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleContinueFromModal} style={{ padding: '10px 28px', borderRadius: 20, background: '#00b7ff', color: '#000', border: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 0 12px #00b7ff88' }}>Continue</button>
            </div>
          </div>
          <style>{`
            @keyframes slideUpModal {
              0% { transform: translateY(100%); }
              100% { transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
