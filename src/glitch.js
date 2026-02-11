import React, { useEffect, useRef } from 'react';

// Simple letter glitch effect with pure Canvas - no external dependencies
const LetterGlitch = ({
  glitchSpeed = 50,
  centerVignette = true,
  outerVignette = false,
  smooth = true,
  glitchColors = ["#ffffff", "#ff5555", "#55ff55"]
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationId;
    let letters = [];
    let w, h;

    // Setting up the canvas dimensions
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      letters = [];
      setupLetters();
    };

    // Create letters
    const setupLetters = () => {
      const charCount = Math.floor((w * h) / 2000); // Adjust density
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

      for (let i = 0; i < charCount; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const char = chars.charAt(Math.floor(Math.random() * chars.length));
        const color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
        const size = Math.random() * 16 + 10;
        const opacity = Math.random() * 0.6 + 0.1;
        
        letters.push({ 
          x, y, char, color, 
          size, 
          opacity,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          glitchTime: 0,
          glitchInterval: Math.random() * 200 + 500
        });
      }
    };

    // Draw vignette effect
    const drawVignette = () => {
      const gradient1 = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.8);
      gradient1.addColorStop(0, "rgba(10,25,47,0.0)");
      gradient1.addColorStop(1, "rgba(10,25,47,0.95)");
      
      const gradient2 = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.5);
      gradient2.addColorStop(0, "rgba(10,25,47,0.5)");
      gradient2.addColorStop(0.7, "rgba(10,25,47,0.0)");
      
      if (outerVignette) {
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, w, h);
      }
      
      if (centerVignette) {
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, w, h);
      }
    };

    // Animation loop
    const animate = () => {
      ctx.fillStyle = "rgba(10,25,47,0.1)";
      ctx.fillRect(0, 0, w, h);
      
      letters.forEach(letter => {
        // Move slightly
        letter.x += letter.vx;
        letter.y += letter.vy;
        
        // Wrap around screen
        if (letter.x < 0) letter.x = w;
        if (letter.x > w) letter.x = 0;
        if (letter.y < 0) letter.y = h;
        if (letter.y > h) letter.y = 0;
        
        // Glitch effect
        letter.glitchTime++;
        if (letter.glitchTime > letter.glitchInterval) {
          letter.char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()".charAt(
            Math.floor(Math.random() * 72)
          );
          letter.color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
          letter.glitchTime = 0;
          letter.glitchInterval = Math.random() * 200 + 500;
        }
        
        // Draw letter
        ctx.globalAlpha = letter.opacity;
        ctx.fillStyle = letter.color;
        ctx.font = `${letter.size}px monospace`;
        ctx.fillText(letter.char, letter.x, letter.y);
      });
      
      // Apply vignette on top
      drawVignette();
      
      animationId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    resize();
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, [glitchSpeed, centerVignette, outerVignette, smooth, glitchColors]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%", 
        height: "100%",
        background: "#0a192f"
      }}
    />
  );
};

export default LetterGlitch;
