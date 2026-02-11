import React, { useEffect } from 'react';
import '../styles/GlitchBackground.css';

const GlitchBackground = () => {
  useEffect(() => {
    const canvas = document.getElementById('glitchCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas to full window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Function to generate glitch effect
    let time = 0;
    const drawGlitch = () => {
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Fill with dark background
      ctx.fillStyle = 'rgba(10, 25, 47, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Number of glitch lines
      const lineCount = 20;
      
      // Create glitch lines
      for (let i = 0; i < lineCount; i++) {
        const randomHeight = Math.random() * canvas.height;
        const randomWidth = Math.random() * 200 + 50;
        const randomX = Math.random() * canvas.width;
        
        // Create random gradient for line
        const gradient = ctx.createLinearGradient(randomX, randomHeight, randomX + randomWidth, randomHeight);
        
        // Electric blue color scheme
        gradient.addColorStop(0, 'rgba(30, 144, 255, 0)');
        gradient.addColorStop(0.5, `rgba(65, 105, 225, ${Math.random() * 0.8})`);
        gradient.addColorStop(1, 'rgba(30, 144, 255, 0)');
        
        ctx.fillStyle = gradient;
        
        // Draw glitch line
        ctx.fillRect(randomX, randomHeight, randomWidth, Math.random() * 5 + 1);
      }
      
      // Add occasional large glitch
      if (Math.random() > 0.97) {
        const height = Math.random() * (canvas.height / 4);
        const y = Math.random() * canvas.height;
        
        // Create random gradient
        const gradient = ctx.createLinearGradient(0, y, canvas.width, y);
        gradient.addColorStop(0, 'rgba(65, 105, 225, 0)');
        gradient.addColorStop(0.5, `rgba(30, 144, 255, ${Math.random() * 0.2})`);
        gradient.addColorStop(1, 'rgba(65, 105, 225, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, y, canvas.width, height);
      }
      
      // Add grid lines
      ctx.strokeStyle = 'rgba(65, 105, 225, 0.15)';
      ctx.lineWidth = 1;
      
      const gridSize = 50;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      time += 0.01;
      requestAnimationFrame(drawGlitch);
    };
    
    drawGlitch();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  return <canvas id="glitchCanvas" className="glitch-canvas"></canvas>;
};

export default GlitchBackground; 