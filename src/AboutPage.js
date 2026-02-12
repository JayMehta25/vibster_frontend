import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileCard from './components/ProfileCard';

const jayPhoto = process.env.PUBLIC_URL + '/profile.png'; // Use the profile.png from public folder

// Glowing Twitter icon
const TwitterIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 0 8px #1DA1F2)' }} fill="#1DA1F2" xmlns="http://www.w3.org/2000/svg"><path d="M24 4.557a9.93 9.93 0 0 1-2.828.775A4.932 4.932 0 0 0 23.337 3.1a9.864 9.864 0 0 1-3.127 1.195A4.916 4.916 0 0 0 16.616 2c-2.72 0-4.924 2.206-4.924 4.924 0 .386.044.762.127 1.124C7.728 7.89 4.1 6.13 1.671 3.149c-.423.724-.666 1.562-.666 2.475 0 1.708.87 3.216 2.188 4.099a4.904 4.904 0 0 1-2.229-.616c-.054 2.281 1.581 4.415 3.949 4.89a4.936 4.936 0 0 1-2.224.084c.627 1.956 2.444 3.377 4.6 3.417A9.867 9.867 0 0 1 0 21.543a13.94 13.94 0 0 0 7.548 2.212c9.057 0 14.009-7.513 14.009-14.009 0-.213-.005-.425-.014-.636A10.012 10.012 0 0 0 24 4.557z" /></svg>
);

// Latest Instagram logo (gradient) with glow
const InstagramIcon = () => (
  <svg width="32" height="32" viewBox="0 0 448 448" style={{ filter: 'drop-shadow(0 0 8px #fd1d1d)' }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="ig-gradient" cx="30%" cy="107%" r="150%" fx="30%" fy="107%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <rect x="32" y="32" width="384" height="384" rx="90" fill="url(#ig-gradient)" />
    <circle cx="224" cy="224" r="96" fill="#fff" fillOpacity="0.7" />
    <circle cx="224" cy="224" r="72" fill="url(#ig-gradient)" />
    <circle cx="336" cy="112" r="24" fill="#fff" fillOpacity="0.7" />
    <circle cx="336" cy="112" r="16" fill="url(#ig-gradient)" />
  </svg>
);

// Actual Gmail logo (envelope with red M) with glow
const GmailIcon = () => (
  <svg width="32" height="32" viewBox="0 0 48 48" style={{ filter: 'drop-shadow(0 0 8px #ea4335)' }} xmlns="http://www.w3.org/2000/svg">
    <g>
      <rect x="4" y="8" width="40" height="32" rx="4" fill="#fff" />
      <path d="M44 12v24c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V12l20 15 20-15z" fill="#fff" />
      <path d="M44 12l-20 15L4 12V8c0-2.2 1.8-4 4-4h32c2.2 0 4 1.8 4 4v4z" fill="#f2f2f2" />
      <path d="M24 27L4 12l2.7-2.7L24 21.3l17.3-12L44 12z" fill="#ea4335" />
      <path d="M44 12v24c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V12l20 15 20-15z" fill="none" stroke="#ea4335" strokeWidth="2" />
    </g>
  </svg>
);

const socials = [
  {
    name: 'Twitter',
    url: 'https://twitter.com/jaymehta',
    icon: <TwitterIcon />,
  },
  {
    name: 'Instagram',
    url: 'https://instagram.com/jaymehta',
    icon: <InstagramIcon />,
  },
  {
    name: 'Gmail',
    url: 'mailto:jaymehta@gmail.com',
    icon: <GmailIcon />,
  },
];

// Moving gradient style for the button (gradient text only, no background/box)
const gradientBtnStyle = {
  background: 'none',
  backgroundImage: 'linear-gradient(270deg, #00d8ff, #00ffd0, #00d8ff)',
  backgroundSize: '400% 400%',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  animation: 'gradientMove 3s ease infinite',
  color: 'inherit',
  border: 'none',
  borderRadius: 0,
  padding: 0,
  fontWeight: 500,
  fontSize: '0.95rem',
  cursor: 'pointer',
  marginTop: 8,
  boxShadow: 'none',
  letterSpacing: 1,
  textShadow: '0 0 4px #00d8ff',
  outline: 'none',
  display: 'inline-block',
};

// Add keyframes for the moving gradient
if (!document.getElementById('gradient-move-keyframes')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'gradient-move-keyframes';
  styleSheet.innerHTML = `
@keyframes gradientMove {
  0% {background-position: 0% 50%;}
  50% {background-position: 100% 50%;}
  100% {background-position: 0% 50%;}
}`;
  document.head.appendChild(styleSheet);
}


export default function AboutPage() {
  const [showDetails, setShowDetails] = useState(false);
  const [exitAnim, setExitAnim] = useState(false);
  const isMobile = window.innerWidth <= 600;
  const navigate = useNavigate();

  // Centering helper (now only for inner flex row/column)
  const centerFlex = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 900,
    minHeight: 400,
    gap: isMobile ? 24 : 0,
    margin: '0 auto',
  };

  // Handler for back button with fade animation
  const handleBack = () => {
    setExitAnim(true);
    setTimeout(() => {
      navigate('/Home');
      setExitAnim(false);
    }, 1000); // Increased duration for slower fade
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        minWidth: '100vw',
        background: 'black',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .about-exit-anim {
          animation: aboutPageFadeOut 1s ease-in-out forwards;
        }
        @keyframes aboutPageFadeOut {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.98);
            filter: blur(1px);
          }
          100% {
            opacity: 0;
            transform: scale(0.95);
            filter: blur(3px);
          }
        }
      `}</style>
      {/* Back to Home Button */}
      <button
        onClick={handleBack}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: 'rgba(0,216,255,0.12)',
          color: '#00d8ff',
          border: 'none',
          borderRadius: 20,
          padding: '8px 18px',
          fontWeight: 600,
          fontSize: '1rem',
          cursor: 'pointer',
          boxShadow: '0 0 10px #00d8ff44',
          zIndex: 10,
          transition: 'background 0.2s',
        }}
      >
        ← Back to Home
      </button>
      <div className={exitAnim ? 'about-exit-anim' : ''} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <h1 style={{
          color: '#00d8ff',
          marginBottom: '2.5rem',
          textAlign: 'center',
          textShadow: '0 0 18px #00d8ff, 0 0 30px #fff',
          fontFamily: 'Audiowide, Poppins, "Segoe UI", Arial, sans-serif',
          fontSize: isMobile ? '2.2rem' : '3.2rem',
          letterSpacing: '2px',
          lineHeight: 1.2,
          marginLeft: 0,
          marginRight: 0,
          width: '100%',
          maxWidth: 700,
          margin: '0 auto 2.5rem auto',
        }}>
          About Us
        </h1>
        <div style={centerFlex}>
          {/* Card Flip for Mobile */}
          {isMobile ? (
            <div
              style={{
                perspective: '1200px',
                width: '100%',
                maxWidth: 340,
                margin: '0 auto',
                minHeight: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  minHeight: 400,
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.8s cubic-bezier(.77,0,.18,1)',
                  transform: showDetails ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  margin: '0 auto',
                }}
              >
                {/* Front Side */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    zIndex: showDetails ? 1 : 2,
                    cursor: showDetails ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={() => {
                    if (showDetails) setShowDetails(false);
                  }}
                >
                  <ProfileCard
                    name="Jay Mehta"
                    title="Doing Everything Possible!"
                    handle="jaymehta"
                    status="Online"
                    contactText={<span style={gradientBtnStyle}>Click Me</span>}
                    avatarUrl={jayPhoto}
                    showUserInfo={true}
                    enableTilt={true}
                    onContactClick={() => setShowDetails(true)}
                    standardLayout={true}
                  />
                </div>
                {/* Back Side (Creator Details) */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'rgba(0, 216, 255, 0.08)',
                    borderRadius: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 30px #00d8ff44',
                    padding: '2.5rem 2rem',
                    zIndex: showDetails ? 2 : 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowDetails(false)}
                >
                  <h2 style={{ color: '#00d8ff', fontFamily: 'Audiowide, Poppins, "Segoe UI", Arial, sans-serif', fontSize: '2.1rem', marginBottom: 18, marginTop: 0, textShadow: '0 0 10px #00d8ff', textAlign: 'center' }}>
                    Creator Details
                  </h2>
                  <div style={{ color: '#fff', fontSize: '1.15rem', marginBottom: 24, fontFamily: 'Poppins, "Segoe UI", Arial, sans-serif', textAlign: 'center' }}>
                    Doing Everything Possible!<br />
                    <span style={{ color: '#fff', fontSize: '1rem' }}>Feel free to contact me anytime !!</span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
                    {socials.map(social => (
                      <a
                        key={social.name}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        title={social.name}
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                  <div style={{ marginTop: 24, color: '#00d8ff', fontSize: '1rem', textAlign: 'center' }}>
                    Tap anywhere to go back
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  flex: '0 0 350px',
                  transition: 'transform 0.8s cubic-bezier(.77,0,.18,1)',
                  transform: showDetails ? 'translateX(-180px)' : 'translateX(0)',
                  zIndex: 2,
                  margin: '0 auto',
                  width: 350,
                  maxWidth: 350,
                  cursor: showDetails ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => {
                  if (showDetails) setShowDetails(false);
                }}
              >
                <ProfileCard
                  name="Jay Mehta"
                  title="Doing Everything Possible!"
                  handle="jaymehta"
                  status="Online"
                  contactText={<span style={gradientBtnStyle}>Click Me</span>}
                  avatarUrl={jayPhoto}
                  showUserInfo={true}
                  enableTilt={true}
                  onContactClick={() => setShowDetails(true)}
                  standardLayout={true}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  opacity: showDetails ? 1 : 0,
                  pointerEvents: showDetails ? 'auto' : 'none',
                  transition: 'opacity 0.8s cubic-bezier(.77,0,.18,1)',
                  marginLeft: showDetails ? 40 : 0,
                  marginRight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  minWidth: 250,
                  maxWidth: 350,
                  background: showDetails ? 'rgba(0, 216, 255, 0.08)' : 'none',
                  borderRadius: 20,
                  padding: showDetails ? '2.5rem 2rem' : 0,
                  boxShadow: showDetails ? '0 0 30px #00d8ff44' : 'none',
                  position: 'relative',
                }}
              >
                {showDetails && (
                  <>
                    <h2 style={{ color: '#00d8ff', fontFamily: 'Audiowide, Poppins, "Segoe UI", Arial, sans-serif', fontSize: '2.1rem', marginBottom: 18, marginTop: 0, textShadow: '0 0 10px #00d8ff', textAlign: 'left' }}>
                      Creator Details
                    </h2>
                    <div style={{ color: '#fff', fontSize: '1.15rem', marginBottom: 24, fontFamily: 'Poppins, "Segoe UI", Arial, sans-serif', textAlign: 'left' }}>
                      <strong>Jay Mehta</strong><br />
                      Doing Everything Possible!<br />
                      <span style={{ color: '#fff', fontSize: '1rem' }}>feel free to contact me anytime !!</span>
                    </div>
                    <div style={{ display: 'flex', gap: 24, justifyContent: 'flex-start' }}>
                      {socials.map(social => (
                        <a
                          key={social.name}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          title={social.name}
                        >
                          {social.icon}
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 