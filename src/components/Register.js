import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Register.css';

const API_URL = 'https://b76d1a8e5996.ngrok-free.app/';
// const API_URL = 'https://chatroulletexbackend-production-adb8.up.railway.app'; // Make sure this matches your backend

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  // const API_URL = 'https://chatroulletexbackend-production-adb8.up.railway.app'; // Make sure this matches your backend

  // Validate form before submission
  const validateForm = () => {
    // Check for empty fields
    if (!username || !email || !password || !confirmPassword) {
      Swal.fire({
        title: 'Empty Fields',
        text: 'Please fill out all fields before continuing',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return false;
    }
    
    // Check if passwords match
    if (password !== confirmPassword) {
      Swal.fire({
        title: 'Password Mismatch',
        text: 'Password and Confirm Password do not match',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return false;
    }
    
    // Additional validation for username
    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate the form first
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // const response = await axios.post(`https://chatroulletexbackend-production-adb8.up.railway.app/register`, { 
      //   username, 
      //   email, 
      //   password 
      // });
      
      // Store email for verification
      localStorage.setItem('email', email);
      localStorage.setItem('username', username);
      localStorage.setItem('verificationEmail', email);
      
      // Show success alert before redirecting
      Swal.fire({
        title: 'Registration Successful!',
        text: 'Please verify your email to continue',
        icon: 'success',
        confirmButtonText: 'Verify Now'
      }).then(() => {
        // Redirect to verification page
        navigate('/verify-email');
      });
      
    } catch (error) {
      if (error.response) {
        setError(error.response.data.message || 'Registration failed. Please try again.');
        
        // Provide more specific error for username uniqueness
        if (error.response.data.message.includes('username')) {
          setError('This username is already taken. Please choose another one.');
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12">
              <h1 className="text-center mb-4">Create Account</h1>
              
              {error && (
                <div className="alert alert-danger text-center" role="alert">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="text-center">
                <div className="form-group mb-3">
                  <input
                    type="text"
                    className="form-control mx-auto"
                    style={{ width: '80%', maxWidth: '350px' }}
                    id="username"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group mb-3">
                  <input
                    type="email"
                    className="form-control mx-auto"
                    style={{ width: '80%', maxWidth: '350px' }}
                    id="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group mb-4">
                  <input
                    type="password"
                    className="form-control mx-auto"
                    style={{ width: '80%', maxWidth: '350px' }}
                    id="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group mb-4">
                  <input
                    type="password"
                    className="form-control mx-auto"
                    style={{ width: '80%', maxWidth: '350px' }}
                    id="confirmPassword"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="btn btn-primary btn-lg px-5 mx-auto d-block"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Creating Account...
                    </>
                  ) : 'Sign Up'}
                </button>
              </form>
              
              <div className="text-center mt-4 form-footer">
                Already have an account? <Link to="/login" className="text-decoration-none">Sign In</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register; 