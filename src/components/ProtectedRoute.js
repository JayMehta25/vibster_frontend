import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth()

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#000',
                color: '#00d8ff',
                fontSize: '1.5rem',
                fontFamily: 'Orbitron, sans-serif'
            }}>
                <div style={{
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '3px solid rgba(0, 216, 255, 0.3)',
                        borderTop: '3px solid #00d8ff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }}></div>
                    <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
                    Loading...
                </div>
            </div>
        )
    }

    // Redirect to auth if not authenticated
    if (!user) {
        return <Navigate to="/auth" replace />
    }

    // Render children if authenticated
    return children
}

export default ProtectedRoute
