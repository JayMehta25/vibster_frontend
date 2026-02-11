// ParticlesPage.js
import React from 'react';
import Particles from './particlepage'; // Import the Particles component

const ParticlesPage = () => {
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'black',
      }}
    >
      <Particles
        particleCount={400}
        particleSpread={5}
        speed={0.1}
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
    </div>
  );
};

export default ParticlesPage;
