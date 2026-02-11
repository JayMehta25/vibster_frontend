import React from 'react';
import CardSwap, { Card } from './CardSwap';

const features = [
  { icon: '🔒', label: 'Private & Encrypted Chats' },
  { icon: '🔑', label: 'Room Code Entry' },
  { icon: '🎯', label: 'Interest-Based Matching' },
  { icon: '🎲', label: 'Chat with Random People' },
  { icon: '🤝', label: 'Add Friends After Chatting' },
  { icon: '📱', label: 'Mobile Friendly' },
  { icon: '⚡', label: 'Real-Time Messaging' },
  { icon: '🌐', label: 'Global Community' },
];

const cardStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '2rem',
    border: '1px solid rgba(0, 183, 255, 0.5)',
    boxShadow: '0 0 30px rgba(0, 216, 255, 0.2)',
    color: '#fff',
};

const iconStyle = {
    fontSize: '5rem',
    marginBottom: '1.5rem',
};

const labelStyle = {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#00d8ff',
    textShadow: '0 0 10px rgba(0, 216, 255, 0.7)',
};

const FeaturesAnimated = () => (
    <div style={{ width: '100%', maxWidth: '700px', height: '650px', position: 'relative', margin: '0 auto' }}>
        <CardSwap
            cardDistance={60}
            verticalDistance={70}
            delay={2000}
            pauseOnHover={true}
            width={500}
            height={500}
        >
            {features.map((feature, index) => (
                <Card key={index} style={cardStyle}>
                    <div style={iconStyle}>{feature.icon}</div>
                    <div style={labelStyle}>{feature.label}</div>
                </Card>
            ))}
        </CardSwap>
    </div>
);

export default FeaturesAnimated; 