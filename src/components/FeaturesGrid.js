import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FeaturesGrid.css';

const features = [
  { title: 'AI Chat Assistant', description: 'Get AI-powered suggestions and assistance when chatting with strangers.' },
  { title: 'Voice & Video Calls', description: 'Seamless voice and video calls with TURN/STUN support.' },
  { title: 'Media Sharing', description: 'Share images, videos, and files instantly.' },
  { title: 'Customizable Themes', description: 'Personalize your chat experience with unique themes.' },
  { title: 'Real-time Notifications', description: 'Stay updated with instant notifications.' },
  { title: 'User Reviews', description: 'See what others think with our interactive reviews globe.' },
  { title: 'Secure & Private', description: 'Your data is protected with end-to-end encryption.' },
  { title: 'Mobile Optimized', description: 'Enjoy a smooth experience on any device.' },
];

const FLIP_INTERVAL = 5000; // ms between each card flip (5 seconds)
const GLOW_DURATION = 1000; // ms glow duration
const WAVE_DELAY = 120; // ms between each card in the initial wave

const FeaturesGrid = () => {
  const navigate = useNavigate();
  const [flipped, setFlipped] = useState(Array(features.length).fill(false));
  const [glow, setGlow] = useState(Array(features.length).fill(false));
  const [current, setCurrent] = useState(0); // index of the currently flipping card
  const [waveDone, setWaveDone] = useState(false);

  // Initial wave: flip all cards in a wave, then flip them back
  useEffect(() => {
    let timeouts = [];
    if (!waveDone) {
      // Flip each card in order
      features.forEach((_, idx) => {
        timeouts.push(setTimeout(() => {
          setFlipped(f => {
            const newF = [...f];
            newF[idx] = true;
            return newF;
          });
          setGlow(g => {
            const newG = [...g];
            newG[idx] = true;
            return newG;
          });
          setTimeout(() => {
            setGlow(g => {
              const newG = [...g];
              newG[idx] = false;
              return newG;
            });
          }, GLOW_DURATION);
        }, idx * WAVE_DELAY));
      });
      // After all cards are flipped, flip them all back after a short pause
      const totalWave = features.length * WAVE_DELAY + 600;
      timeouts.push(setTimeout(() => {
        setFlipped(Array(features.length).fill(false));
        setWaveDone(true);
      }, totalWave));
    }
    return () => timeouts.forEach(clearTimeout);
  }, [waveDone]);

  // After wave, start one-card-at-a-time auto-flip
  useEffect(() => {
    if (!waveDone) return;
    let timeout;
    const flipCard = (idx) => {
      setFlipped(f => {
        const newF = Array(features.length).fill(false);
        newF[idx] = true;
        return newF;
      });
      setGlow(g => {
        const newG = Array(features.length).fill(false);
        newG[idx] = true;
        return newG;
      });
      setTimeout(() => {
        setGlow(g => {
          const newG = [...g];
          newG[idx] = false;
          return newG;
        });
      }, GLOW_DURATION);
    };
    flipCard(current);
    timeout = setTimeout(() => {
      setCurrent(c => (c + 1) % features.length);
    }, FLIP_INTERVAL);
    return () => clearTimeout(timeout);
  }, [current, waveDone]);

  // Handle card click: flip and glow
  const handleCardClick = idx => {
    setFlipped(f => {
      const newF = [...f];
      newF[idx] = !newF[idx];
      return newF;
    });
    setGlow(g => {
      const newG = [...g];
      newG[idx] = true;
      return newG;
    });
    setTimeout(() => {
      setGlow(g => {
        const newG = [...g];
        newG[idx] = false;
        return newG;
      });
    }, GLOW_DURATION);
  };

  return (
    <div className="features-grid-container">
      <button className="features-home-btn" onClick={() => navigate('/Home')} title="Home">
        <span role="img" aria-label="Home" style={{fontSize: '1.3em', lineHeight: 1}}>🏠</span>
      </button>
      <h2 className="features-title">Explore Our Features</h2>
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
          >
            <div className="flip-card-inner">
              <div className="flip-card-front">
                <h3>{feature.title}</h3>
              </div>
              <div className="flip-card-back">
                <p>{feature.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Reviews Button */}
      <div className="reviews-button-container">
        <button 
          className="reviews-button" 
          onClick={() => navigate('/user-reviews')}
          title="View User Reviews"
        >
          <span role="img" aria-label="Reviews" style={{fontSize: '1.2em', marginRight: '0.5rem'}}>🌟</span>
          View User Reviews Globe
        </button>
      </div>
    </div>
  );
};

export default FeaturesGrid; 