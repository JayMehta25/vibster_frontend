import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Stepper, { Step } from "./tutorial"; // Ensure this file exports Stepper & Step
import StageLight from "./components/StageLight";
import RippleGrid from "./components/RippleGrid";
import "bootstrap/dist/css/bootstrap.min.css";

const TutorialPage = () => {
  const [name, setName] = useState("");
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();

  // Called when the user finishes the final step
  const handleFinalStepCompleted = () => {
    // Trigger the fade-out animation
    setFadeOut(true);

    // Store the name in localStorage for persistence
    localStorage.setItem('username', name);

    // After the animation ends, navigate to the homepage
    setTimeout(() => {
      navigate("/Home", { state: { name } });
    }, 1000); // 1s delay matches fadeOut animation
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: 'Poppins', sans-serif;
          background: #000; /* Black background */
          overflow-x: hidden;
        }

        /* Container that fills the screen, black background */
        .tutorial-container {
          background: #000;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          transition: opacity 1s ease; /* fade animation */
          position: relative;
          overflow: hidden;
        }

        /* Remove any unwanted icons or elements */
        .tutorial-container * {
          background: transparent;
        }

        /* Ensure no unwanted elements appear */
        .tutorial-container::before,
        .tutorial-container::after {
          display: none !important;
        }

        /* Fade-out class triggers an animation to 0 opacity */
        .fade-out {
          opacity: 0;
        }

        /* Transparent card with white text */
        .tutorial-card {
          background: transparent;       /* Completely transparent background */
          color: #fff;           /* White text */
          border-radius: 10px;
          padding: 20px;
          max-width: 100%;
          width: 100%;
          border: none;
          box-shadow: none;
        }

        /* Force transparent backgrounds for stepper elements */
        .step-circle-container,
        .step-indicator-row,
        .step-content-default,
        .step-default,
        .footer-container,
        .outer-container {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* Headings and paragraphs in white */
        .tutorial-card h2,
        .tutorial-card p {
          color: #fff;
          margin-bottom: 1em;
        }

        .tutorial-card h2 {
          font-weight: 600;
          margin-bottom: 20px;
        }

        /* Step images */
        .tutorial-card img {
          height: 150px;
          width: 100%;
          object-fit: cover;
          object-position: center -70px;
          border-radius: 15px;
          margin-top: auto;
        }

        /* Input field with dark background & white text */
        .tutorial-card input {
          width: 100%;
          padding: 10px;
          font-size: 1rem;
          margin-top: 1em;
          border-radius: 8px;
          border: 1px solid #444;
          background: #222;
          color: #fff;
        }

        /* Hide any unwanted icons or elements */
        .tutorial-container img:not(.tutorial-card img),
        .tutorial-container svg:not(.step-indicator svg),
        .tutorial-container .icon,
        .tutorial-container .emoji {
          display: none !important;
        }

        /* Ensure black background everywhere */
        body, html, #root {
          background: #000 !important;
        }
      `}</style>

      <div
        className={`tutorial-container container-fluid ${
          fadeOut ? "fade-out" : ""
        }`}
      >
        {/* RippleGrid Background */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: 1 
        }}>
          <RippleGrid
            enableRainbow={false}
            gridColor="#00d8ff"
            rippleIntensity={0.05}
            gridSize={20}
            gridThickness={12}
            mouseInteraction={true}
            mouseInteractionRadius={1.2}
            opacity={0.6}
            glowIntensity={0.15}
            fadeDistance={1.8}
            vignetteStrength={1.5}
          />
        </div>

        {/* Tutorial Content */}
        <div className="tutorial-card" style={{ position: 'relative', zIndex: 2 }}>
          <Stepper
            initialStep={1}
            onStepChange={(step) => {
              console.log("Step changed to:", step);
            }}
            onFinalStepCompleted={handleFinalStepCompleted}
            backButtonText="Previous"
            nextButtonText="Next"
          >
            <Step>
              <h2>Welcome to Vibester!</h2>
              <p>Check out how to use the app.</p>
            </Step>
            <Step>
              <h2>Connect with random people!</h2>
              <img src="/step1.png" alt="Step 1" />
              <p>Connect with random people based on your interests.</p>
            </Step>
            <Step>
              <h2>Create private rooms</h2>
              <img src="/step2.png" alt="Step 3" />
              <p>Create private rooms and chat with privacy</p>
            </Step>
            <Step>
              <h2>What should we call you?</h2>
              <p>Enter your name to get started.</p>
              <input
                type="text"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-control"
              />
            </Step>
          </Stepper>
        </div>
      </div>
    </>
  );
};

export default TutorialPage;
