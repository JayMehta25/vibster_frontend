import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './OnlineCounter.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const OnlineCounter = () => {
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Connect to socket
        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });

        setSocket(newSocket);

        // Listen for online user updates
        newSocket.on('onlineUsersUpdate', (count) => {
            setOnlineUsers(count);
            console.log('Online users updated:', count);
        });

        // Cleanup on unmount
        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, []);

    return (
        <div className="online-counter">
            <div className="online-indicator"></div>
            <span className="online-count">{onlineUsers.toLocaleString()}</span>
            <span className="online-label">online</span>
        </div>
    );
};

export default OnlineCounter;
