import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import FloatingLines from './FloatingLines'
import Swal from 'sweetalert2'
import { motion } from 'framer-motion'

const ResetPassword = () => {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const { updatePassword } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            Swal.fire({
                title: 'Error',
                text: 'Passwords do not match',
                icon: 'error',
                background: 'rgba(10, 20, 30, 0.95)',
                color: '#fff'
            })
            return
        }

        setLoading(true)
        try {
            const { error } = await updatePassword(password)
            if (error) throw error

            Swal.fire({
                title: 'Success',
                text: 'Password updated successfully! You can now log in.',
                icon: 'success',
                background: 'rgba(10, 20, 30, 0.95)',
                color: '#fff'
            })
            navigate('/auth')
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: error.message || 'Failed to update password',
                icon: 'error',
                background: 'rgba(10, 20, 30, 0.95)',
                color: '#fff'
            })
        } finally {
            setLoading(false)
        }
    }

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

            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
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
                    boxShadow: '0 0 40px rgba(0, 183, 235, 0.2)'
                }}
            >
                <h1 style={{
                    color: '#00d8ff',
                    textAlign: 'center',
                    marginBottom: '30px',
                    fontFamily: 'Orbitron, sans-serif',
                    textShadow: '0 0 20px rgba(0, 216, 255, 0.5)'
                }}>
                    New Password
                </h1>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ color: '#00d8ff', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>New Password</label>
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
                                color: '#fff'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ color: '#00d8ff', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'rgba(0, 0, 0, 0.5)',
                                border: '1px solid rgba(0, 183, 235, 0.3)',
                                borderRadius: '8px',
                                color: '#fff'
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: 'linear-gradient(45deg, #00b7ff, #00d4ff)',
                            border: 'none',
                            borderRadius: '12px',
                            color: '#000',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/auth')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#00d8ff',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            marginTop: '10px'
                        }}
                    >
                        Return to Login
                    </button>
                </form>
            </motion.div>
        </div>
    )
}

export default ResetPassword
