import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/tutorial" />} />
          
          {/* Main Application Routes */}
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/Home" element={<Home_page />} />
          <Route path="/TutorialPage" element={<TutorialPage />} />
          <Route path="/chatlanding" element={<ChatLanding />} />
          <Route path="/chatmain" element={<ChatMain />} />
          <Route path="/features" element={<FeaturesGrid />} />
          <Route path="/interest-chat" element={<InterestChat />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/user-reviews" element={<UserReviewsPage />} />
          <Route path="/voicecall" element={<VoiceCall />} />
          <Route path="/videocall" element={<VideoCall />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;