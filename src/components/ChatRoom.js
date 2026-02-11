import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ChatRoom = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication on component mount
    const token = localStorage.getItem('token');
    console.log('ChatRoom - Token exists:', !!token);
    
    if (!token) {
      console.log('No token found in ChatRoom, should redirect via PrivateRoute');
    }
  }, []);

  const handleGenerateRoomCode = async () => {
    try {
      console.log('Generating room code...');
      
      // Check if user is authenticated first
      const token = localStorage.getItem('token');
      console.log('Generate room - Token exists:', !!token);
      
      if (!token) {
        console.log('No token found when generating room code, redirecting to login');
        navigate('/login');
        return;
      }

      // Generate the room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      console.log('Room code generated:', roomCode);
      
      // Store the room code
      localStorage.setItem('currentRoomCode', roomCode);
      console.log('Room code saved to localStorage');

      // Redirect to chatmain with the room code
      console.log('Navigating to /chatmain');
      navigate('/chatmain', { state: { roomCode } });
      
      // Optionally, you can also show a success message
      // toast.success(`Room code generated: ${roomCode}`);
    } catch (error) {
      console.error('Error generating room code:', error);
      // Handle error appropriately
    }
  };

  useEffect(() => {
    handleGenerateRoomCode();
  }, [navigate]);

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default ChatRoom; 