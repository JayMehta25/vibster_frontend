import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'bot', text: 'Hello! How can I help you with Vibester today?' }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const [promptText, setPromptText] = useState('');
    const [showPrompt, setShowPrompt] = useState(true);
    const promptFullText = "Need any help? I can do it for you now!";

    const prompts = [
        "How do I use the interest-based chat?",
        "How do I create a private room?",
        "Is my chat history saved?",
        "How do I change my chat bubble color?"
    ];

    const responses = {
        "How do I use the interest-based chat?": "To use the interest-based chat, go to the Home page, select your interests from the list, and click the 'Engage' button. You'll be connected with others who share your interests!",
        "How do I create a private room?": "You can create a private room from the 'Chat Now' page. Enter your username, and then click 'Generate Chat Room Code'. Share the code with your friends so they can join you.",
        "Is my chat history saved?": "For your privacy, chat history in private rooms is not permanently stored on our servers. History is only available for the current session.",
        "How do I change my chat bubble color?": "You can choose your chat bubble color on the 'Chat Now' page before creating or joining a room. You'll find a color picker next to the username input."
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages, isTyping]);

    // Typewriter effect for idle prompt
    useEffect(() => {
        if (!isOpen && showPrompt) {
            setPromptText('');
            let idx = 0;
            const typeInterval = setInterval(() => {
                setPromptText(promptFullText.slice(0, idx + 1));
                idx++;
                if (idx === promptFullText.length) {
                    clearInterval(typeInterval);
                }
            }, 40);
            // Hide prompt after 25 seconds
            const hideTimeout = setTimeout(() => setShowPrompt(false), 25000);
            return () => {
                clearInterval(typeInterval);
                clearTimeout(hideTimeout);
            };
        }
    }, [isOpen, showPrompt]);

    // Show prompt again if chatbot is closed
    useEffect(() => {
        if (!isOpen) setShowPrompt(true);
    }, [isOpen]);

    const typeResponse = (response) => {
        let index = 0;
        const interval = setInterval(() => {
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { sender: 'bot', text: response.substring(0, index + 1) };
                return newMessages;
            });
            index++;
            if (index === response.length) {
                clearInterval(interval);
                setIsTyping(false);
            }
        }, 30);
    };

    const handlePromptClick = (prompt) => {
        const userMessage = { sender: 'user', text: prompt };
        setMessages(prev => [...prev, userMessage]);
        setIsTyping(true);

        setTimeout(() => {
            const botResponse = { sender: 'bot', text: '' };
            setMessages(prev => [...prev, botResponse]);
            typeResponse(responses[prompt]);
        }, 1000);
    };

    return (
        <div className="chatbot-container">
            {isOpen && (
                <div className="chatbot-window">
                    <div className="chatbot-header">
                        <span>Vibester Assistant</span>
                        <button onClick={() => setIsOpen(false)}>✕</button>
                    </div>
                    <div className="chatbot-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message-row ${msg.sender}`}> 
                                {msg.sender === 'bot' && <div className="avatar bot-avatar">🤖</div>}
                                <div className={`message-bubble ${msg.sender}`}>{msg.text}</div>
                                {msg.sender === 'user' && <div className="avatar user-avatar">🧑</div>}
                            </div>
                        ))}
                        {isTyping && <div className="message-row bot"><div className="avatar bot-avatar">🤖</div><div className="message-bubble bot typing-indicator"><span></span><span></span><span></span></div></div>}
                        <div ref={messagesEndRef} />
                    </div>
                    {/* Show prompt suggestions above input if chat is empty or only has welcome */}
                    {messages.length <= 1 && (
                        <div className="chatbot-prompts-suggestions">
                            {prompts.map((prompt, index) => (
                                <button key={index} onClick={() => handlePromptClick(prompt)}>
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="chatbot-input-area">
                        <input
                            type="text"
                            value={promptText}
                            onChange={e => setPromptText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && promptText.trim() && handlePromptClick(promptText)}
                            placeholder="Type your message..."
                        />
                        <button
                            onClick={() => promptText.trim() && handlePromptClick(promptText)}
                            disabled={!promptText.trim()}
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
            <div className="chatbot-toggle-and-prompt">
                <button className="chatbot-toggle" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? '✕' : '🤖'}
                </button>
                {!isOpen && showPrompt && (
                    <div className="chatbot-prompt">
                        {promptText}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Chatbot; 