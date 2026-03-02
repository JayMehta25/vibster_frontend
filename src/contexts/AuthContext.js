import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState(null)

    const authRedirectUrl =
        process.env.REACT_APP_AUTH_REDIRECT_URL || `${window.location.origin}/auth`

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signUp = async (email, password, username) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: authRedirectUrl,
                    data: {
                        username: username,
                    }
                }
            })

            if (error) throw error

            // Create profile in profiles table
            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: data.user.id,
                            username: username,
                            email: email,
                            avatar_url: '',
                            interests: []
                        }
                    ])

                if (profileError) {
                    console.error('Profile creation error:', profileError)
                }
            }

            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const signIn = async (identifier, password) => {
        try {
            let emailToUse = identifier.trim()

            // If the identifier doesn't look like an email, look up the email by username
            if (!emailToUse.includes('@')) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', emailToUse)
                    .single()

                if (profileError || !profileData?.email) {
                    return { data: null, error: { message: 'No account found with that username.' } }
                }
                emailToUse = profileData.email
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password
            })

            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const resetPassword = async (email) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })
            if (error) throw error
            return { error: null }
        } catch (error) {
            return { error }
        }
    }

    const updatePassword = async (newPassword) => {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })
            if (error) throw error
            return { error: null }
        } catch (error) {
            return { error }
        }
    }

    const signOut = async () => {
        try {
            // Use 'local' scope to avoid 403 when server token is already expired
            await supabase.auth.signOut({ scope: 'local' })
        } catch (err) {
            console.warn('Sign out server error (ignored):', err)
        } finally {
            // Always clear local state regardless of server response
            localStorage.removeItem('username')
        }
        return { error: null }
    }

    const updateProfile = async (updates) => {
        try {
            if (!user) throw new Error('No user logged in')

            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single()

            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const getProfile = async () => {
        try {
            if (!user) throw new Error('No user logged in')

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const value = {
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        getProfile,
        resetPassword,
        updatePassword
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext
