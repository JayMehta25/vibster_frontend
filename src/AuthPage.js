import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import FloatingLines from './FloatingLines'
import Swal from 'sweetalert2'
import { motion } from 'framer-motion'

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)

    const navigate = useNavigate()
    const location = useLocation()
    const { signIn, signUp, getProfile, user } = useAuth()

    // Get the name from tutorial if passed
    const tutorialName = location.state?.name || localStorage.getItem('username') || ''

    // Pre-fill username from localStorage or fetch from profile
    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        // Case-insensitive check for generic 'User'
        const isGenericUser = !storedUsername || storedUsername.toLowerCase() === 'user';

        if (tutorialName && !username) { // Keep existing logic for tutorialName
            setUsername(tutorialName);
        } else if (storedUsername && !isGenericUser) {
            setUsername(storedUsername);
        }

        if (user) {
            // Always try to get a better name if we are logged in
            const metaUsername = user.user_metadata?.username;

            const fetchProfile = async () => {
                const { data, error } = await getProfile();
                if (data && data.username) {
                    setUsername(data.username);
                    localStorage.setItem('username', data.username);
                } else if (metaUsername) {
                    // Fallback to metadata if profile fetch fails or has no username
                    setUsername(metaUsername);
                    localStorage.setItem('username', metaUsername);
                }
            };

            fetchProfile();
        }
    }, [user, getProfile, tutorialName, username]);

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isLogin) {
                // Login
                const { data, error } = await signIn(email, password)

                if (error) {
                    Swal.fire({
                        title: 'Login Failed',
                        text: error.message,
                        icon: 'error',
                        background: 'rgba(10, 20, 30, 0.95)',
                        color: '#fff',
                        confirmButtonColor: '#00d8ff'
                    })
                } else {
                    // Fetch profile to get username
                    const { data: profile, error: profileError } = await getProfile()

                    // Prioritize: Profile > Metadata > Fallback
                    const loggedInUsername = profile?.username || data.user.user_metadata?.username || 'User'

                    // Store username in localStorage
                    localStorage.setItem('username', loggedInUsername)

                    Swal.fire({
                        title: `Welcome Back, ${loggedInUsername}!`,
                        text: 'Login successful',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        background: 'rgba(10, 20, 30, 0.95)',
                        color: '#fff'
                    })
                    navigate('/ChatLanding')
                }
            } else {
                // Signup
                if (!username.trim()) {
                    Swal.fire({
                        title: 'Username Required',
                        text: 'Please enter a username',
                        icon: 'warning',
                        background: 'rgba(10, 20, 30, 0.95)',
                        color: '#fff',
                        confirmButtonColor: '#00d8ff'
                    })
                    setLoading(false)
                    return
                }

                const { data, error } = await signUp(email, password, username)

                if (error) {
                    Swal.fire({
                        title: 'Signup Failed',
                        text: error.message,
                        icon: 'error',
                        background: 'rgba(10, 20, 30, 0.95)',
                        color: '#fff',
                        confirmButtonColor: '#00d8ff'
                    })
                } else {
                    Swal.fire({
                        title: 'Confirmation Email Sent!',
                        text: `A link has been sent to ${email}. Please check your inbox and verify your account before logging in.`,
                        icon: 'info',
                        background: 'rgba(10, 20, 30, 0.95)',
                        color: '#fff',
                        confirmButtonColor: '#00d8ff'
                    })

                    // Store username in localStorage for compatibility
                    localStorage.setItem('username', username)

                    // We don't navigate immediately because the user needs to confirm email
                    // But for this flow, if the user allows auto-login after confirmation:
                    // setIsLogin(true) 
                }
            }
        } catch (error) {
            console.error('Auth error:', error)
            Swal.fire({
                title: 'Error',
                text: 'An unexpected error occurred',
                icon: 'error',
                background: 'rgba(10, 20, 30, 0.95)',
                color: '#fff',
                confirmButtonColor: '#00d8ff'
            })
        } finally {
            setLoading(false)
        }
    }

    // Memoize FloatingLines to prevent re-render when switching tabs
    const floatingLinesBackground = React.useMemo(() => (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
        }}>
            <FloatingLines
                enabledWaves={["top", "middle", "bottom"]}
                lineCount={5}
                lineDistance={5}
                bendRadius={5}
                bendStrength={-0.5}
                interactive={true}
                parallax={true}
                linesGradient={['#00b7eb', '#00d8ff', '#0099cc']}
            />
        </div>
    ), []) // Empty dependency array means it only renders once

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            background: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            {/* FloatingLines Background - Memoized */}
            {floatingLinesBackground}

            {/* Back to Home Button */}
            <button
                onClick={() => navigate('/Home')}
                style={{
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    background: 'rgba(0,216,255,0.12)',
                    color: '#00d8ff',
                    border: 'none',
                    borderRadius: 20,
                    padding: '8px 18px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 0 10px #00d8ff44',
                    zIndex: 10,
                    transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(0,216,255,0.2)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(0,216,255,0.12)'}
            >
                ← Back to Home
            </button>

            {/* Auth Card */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                style={{
                    position: 'relative',
                    zIndex: 2,
                    background: 'rgba(10, 20, 30, 0.85)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    padding: '40px',
                    width: '100%',
                    maxWidth: '450px',
                    border: '1px solid rgba(0, 183, 235, 0.3)',
                    boxShadow: '0 0 40px rgba(0, 183, 235, 0.2)',
                    margin: '0 auto'
                }}
            >
                {/* Title */}
                <h1 style={{
                    color: '#00d8ff',
                    textAlign: 'center',
                    marginBottom: '30px',
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: '2.5rem',
                    textShadow: '0 0 20px rgba(0, 216, 255, 0.5)'
                }}>
                    {isLogin ? 'Welcome Back' : 'Join Vibester'}
                </h1>

                {/* Tab Switcher */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '30px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '12px',
                    padding: '5px'
                }}>
                    <button
                        onClick={() => setIsLogin(true)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            border: 'none',
                            borderRadius: '8px',
                            background: isLogin ? 'linear-gradient(45deg, #00b7ff, #00d4ff)' : 'transparent',
                            color: isLogin ? '#000' : '#00d8ff',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: '1rem'
                        }}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setIsLogin(false)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            border: 'none',
                            borderRadius: '8px',
                            background: !isLogin ? 'linear-gradient(45deg, #00b7ff, #00d4ff)' : 'transparent',
                            color: !isLogin ? '#000' : '#00d8ff',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: '1rem'
                        }}
                    >
                        Sign Up
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Username */}
                    <div>
                        <label style={{
                            color: '#00d8ff',
                            fontSize: '0.9rem',
                            marginBottom: '8px',
                            display: 'block',
                            fontWeight: '500'
                        }}>
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            required
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'rgba(0, 0, 0, 0.5)',
                                border: '1px solid rgba(0, 183, 235, 0.3)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#00d8ff'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(0, 183, 235, 0.3)'}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label style={{
                            color: '#00d8ff',
                            fontSize: '0.9rem',
                            marginBottom: '8px',
                            display: 'block',
                            fontWeight: '500'
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'rgba(0, 0, 0, 0.5)',
                                border: '1px solid rgba(0, 183, 235, 0.3)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#00d8ff'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(0, 183, 235, 0.3)'}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label style={{
                            color: '#00d8ff',
                            fontSize: '0.9rem',
                            marginBottom: '8px',
                            display: 'block',
                            fontWeight: '500'
                        }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'rgba(0, 0, 0, 0.5)',
                                border: '1px solid rgba(0, 183, 235, 0.3)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#00d8ff'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(0, 183, 235, 0.3)'}
                        />
                        {!isLogin && (
                            <p style={{
                                color: '#888',
                                fontSize: '0.8rem',
                                marginTop: '5px',
                                marginBottom: 0
                            }}>
                                Minimum 6 characters
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: loading ? '#555' : 'linear-gradient(45deg, #00b7ff, #00d4ff)',
                            border: 'none',
                            borderRadius: '12px',
                            color: '#000',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: loading ? 'none' : '0 0 20px rgba(0, 183, 235, 0.4)',
                            marginTop: '10px'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.target.style.transform = 'translateY(-2px)'
                                e.target.style.boxShadow = '0 0 30px rgba(0, 183, 235, 0.6)'
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) {
                                e.target.style.transform = 'translateY(0)'
                                e.target.style.boxShadow = '0 0 20px rgba(0, 183, 235, 0.4)'
                            }
                        }}
                    >
                        {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
                    </button>
                </form>

                {/* Footer Text */}
                <p style={{
                    textAlign: 'center',
                    color: '#888',
                    fontSize: '0.9rem',
                    marginTop: '20px',
                    marginBottom: 0
                }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span
                        onClick={() => setIsLogin(!isLogin)}
                        style={{
                            color: '#00d8ff',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        {isLogin ? 'Sign Up' : 'Login'}
                    </span>
                </p>
            </motion.div>
        </div>
    )
}

export default AuthPage
