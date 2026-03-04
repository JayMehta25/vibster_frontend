import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './FeaturesGrid.css';

/* ── Feature data with icons & colors ───────────────────────── */
const features = [
  {
    title: 'AI Chat Assistant',
    description: 'Get AI-powered suggestions and real-time assistance when chatting with strangers.',
    icon: '🤖',
    color: '#00b7ff',
  },
  {
    title: 'Voice & Video Calls',
    description: 'Seamless voice and video calls with TURN/STUN support for crystal-clear connections.',
    icon: '📹',
    color: '#a855f7',
  },
  {
    title: 'Media Sharing',
    description: 'Share images, videos, and files instantly with zero friction.',
    icon: '📁',
    color: '#f59e0b',
  },
  {
    title: 'Custom Themes',
    description: 'Personalize your entire chat experience with unique themes and palettes.',
    icon: '🎨',
    color: '#10b981',
  },
  {
    title: 'Live Notifications',
    description: 'Stay updated with blazing-fast real-time notifications as they happen.',
    icon: '🔔',
    color: '#ef4444',
  },
  {
    title: 'Reviews Globe',
    description: 'See what the world thinks with our interactive 3D user-reviews globe.',
    icon: '🌐',
    color: '#ec4899',
  },
  {
    title: 'Secure & Private',
    description: 'Your data is protected with end-to-end encryption and zero-knowledge design.',
    icon: '🔒',
    color: '#14b8a6',
  },
  {
    title: 'Mobile Optimized',
    description: 'Enjoy a buttery-smooth experience on any device, any screen, anywhere.',
    icon: '📱',
    color: '#6366f1',
  },
];

const FLIP_INTERVAL = 4500;
const GLOW_DURATION = 1100;
const WAVE_DELAY = 110;

/* ── Floating particles helper ──────────────────────────────── */
const PARTICLE_COUNT = 28;
const particleStyles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const size = Math.random() * 3 + 1;
  const left = Math.random() * 100;
  const delay = Math.random() * 12;
  const dur = Math.random() * 12 + 10;
  const opacity = Math.random() * 0.5 + 0.2;
  const colors = ['#00b7ff', '#a855f7', '#10b981', '#f59e0b', '#ec4899'];
  const color = colors[i % colors.length];
  return { size, left, delay, dur, opacity, color };
});

/* ─────────────────────────────────────────────────────────────── */
const FeaturesGrid = () => {
  const navigate = useNavigate();
  const [flipped, setFlipped] = useState(Array(features.length).fill(false));
  const [glow, setGlow] = useState(Array(features.length).fill(false));
  const [current, setCurrent] = useState(0);
  const [waveDone, setWaveDone] = useState(false);
  const glowTimersRef = useRef([]);

  const startGlow = (idx) => {
    setGlow(g => { const n = [...g]; n[idx] = true; return n; });
    const t = setTimeout(() => {
      setGlow(g => { const n = [...g]; n[idx] = false; return n; });
    }, GLOW_DURATION);
    glowTimersRef.current.push(t);
  };

  /* Initial wave */
  useEffect(() => {
    const timeouts = [];
    if (!waveDone) {
      features.forEach((_, idx) => {
        timeouts.push(setTimeout(() => {
          setFlipped(f => { const n = [...f]; n[idx] = true; return n; });
          startGlow(idx);
        }, idx * WAVE_DELAY));
      });
      const totalWave = features.length * WAVE_DELAY + 700;
      timeouts.push(setTimeout(() => {
        setFlipped(Array(features.length).fill(false));
        setWaveDone(true);
      }, totalWave));
    }
    return () => timeouts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveDone]);

  /* Sequential auto-flip after wave */
  useEffect(() => {
    if (!waveDone) return;
    const idx = current;
    setFlipped(f => { const n = Array(features.length).fill(false); n[idx] = true; return n; });
    startGlow(idx);
    const t = setTimeout(() => setCurrent(c => (c + 1) % features.length), FLIP_INTERVAL);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, waveDone]);

  /* Cleanup glow timers on unmount */
  useEffect(() => () => glowTimersRef.current.forEach(clearTimeout), []);

  /* Manual click */
  const handleCardClick = idx => {
    setFlipped(f => { const n = [...f]; n[idx] = !n[idx]; return n; });
    startGlow(idx);
  };

  return (
    <div className="features-grid-container">
      {/* Floating particles */}
      <div className="fg-particles" aria-hidden="true">
        {particleStyles.map((p, i) => (
          <div
            key={i}
            className="fg-particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              bottom: '-20px',
              background: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Navbar */}
      <nav className="features-navbar">
        <button
          className="features-home-btn"
          onClick={() => navigate('/Home')}
          title="Back to Home"
        >
          ←&nbsp;Home
        </button>
        <span className="features-nav-brand">VIBESTER</span>
        <span className="features-nav-status">LIVE</span>
      </nav>

      {/* Hero */}
      <header className="features-hero">
        <div className="features-eyebrow">
          <span className="features-eyebrow-dot" aria-hidden="true" />
          Platform Capabilities
        </div>
        <h1 className="features-title">
          Everything You Need.{' '}
          <span className="features-title-glow">All In One Place.</span>
        </h1>
        <p className="features-subtitle">
          Hover or tap any card to reveal what powers Vibester — built for the next generation of real-time connection.
        </p>
      </header>

      {/* Grid */}
      <div className="features-grid-wrapper">
        <div className="features-grid">
          {features.map((feature, idx) => (
            <div
              className={`feature-card flip-card${flipped[idx] ? ' flipped' : ''}${glow[idx] ? ' glow' : ''}`}
              key={idx}
              onClick={() => handleCardClick(idx)}
              tabIndex={0}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleCardClick(idx)}
              role="button"
              aria-pressed={flipped[idx]}
              aria-label={feature.title}
            >
              <div className="flip-card-inner">
                {/* Front */}
                <div className="flip-card-front">
                  <span className="fc-icon" style={{ color: feature.color }}>
                    {feature.icon}
                  </span>
                  <h3>{feature.title}</h3>
                  <div className="fc-accent" />
                </div>
                {/* Back */}
                <div className="flip-card-back">
                  <span className="fc-icon" style={{ color: feature.color }}>
                    {feature.icon}
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="features-divider" aria-hidden="true">
        <span>— User Reviews —</span>
      </div>

      {/* Reviews Globe Button */}
      <div className="reviews-button-container">
        <button
          className="reviews-button"
          onClick={() => navigate('/user-reviews')}
          title="View User Reviews Globe"
        >
          <span className="reviews-button-icon" role="img" aria-label="Globe">🌟</span>
          View User Reviews Globe
        </button>
      </div>
    </div>
  );
};

export default FeaturesGrid;