import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./AuthPage";
import TutorialPage from "./TutorialPage";
import Home_page from "./Home";
import ChatLanding from "./ChatLanding";
import ChatMain from "./ChatMain";
import InterestChat from "./InterestChat";
import AboutPage from './AboutPage';
import UserReviewsPage from './UserReviewsPage';
import VoiceCall from "./components/VoiceCall";
import VideoCall from "./components/VideoCall";
import FeaturesGrid from './components/FeaturesGrid';

function App() {
  return (
    <div>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/tutorial" />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/Home" element={<Home_page />} />
            <Route path="/interest-chat" element={<InterestChat />} />
            <Route path="/features" element={<FeaturesGrid />} />
            <Route path="/about" element={<AboutPage />} />

            {/* Protected routes */}
            <Route path="/TutorialPage" element={<ProtectedRoute><TutorialPage /></ProtectedRoute>} />
            <Route path="/chatlanding" element={<ProtectedRoute><ChatLanding /></ProtectedRoute>} />
            <Route path="/chatmain" element={<ProtectedRoute><ChatMain /></ProtectedRoute>} />
            <Route path="/user-reviews" element={<ProtectedRoute><UserReviewsPage /></ProtectedRoute>} />
            <Route path="/voicecall" element={<ProtectedRoute><VoiceCall /></ProtectedRoute>} />
            <Route path="/videocall" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </Router>
      <Analytics />
    </div>
  );
}

export default App;