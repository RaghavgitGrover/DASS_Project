// In your Root.jsx file
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Login from './login.jsx';
import Signup from './signup.jsx';
import Profile from './profile.jsx';
import GenerateTimeTables from './generateTimeTables.jsx';
import ViewTimeTables from './viewTimeTables.jsx';
import StudentStatistics from './studentStatistics.jsx';
import GenerateSeatingArrangements from './generateSeatingArrangements.jsx';
import ViewSeatingArrangement from './viewSeatingArrangement';
import GenerateInvigilation from './generateInvigilation';
import ViewInvigilation from './viewInvigilation';
import Navbar from './navbar.jsx';
import Notfound from './notfound.jsx';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CasCallback from './CasCallback.jsx';
import CasSuccessHandler from './CasSuccessHandler.jsx';
import NetworkStatus from './components/NetworkStatus.jsx';

// Create a wrapper component to handle URL parameters
function CasLoginHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for CAS login success parameters in URL
    const urlParams = new URLSearchParams(location.search);
    const casLogin = urlParams.get('casLogin');

    console.log("URL search params:", location.search);
    console.log("CAS login parameter:", casLogin);

    if (casLogin === 'success') {
      const email = urlParams.get('email');
      const username = urlParams.get('username');

      console.log('CasLoginHandler detected success parameters:', { email, username });

      if (email && username) {
        // Clear any existing user data
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentUserEmail');
        localStorage.removeItem('currentUserUsername');
        localStorage.removeItem('timetableState');

        // Store user in localStorage (both formats)
        localStorage.setItem('currentUser', JSON.stringify({ email, username }));
        localStorage.setItem('currentUserEmail', email);
        localStorage.setItem('currentUserUsername', username);

        // Trigger storage event
        window.dispatchEvent(new Event('storage'));

        // Clean URL by removing parameters
        navigate('/', { replace: true });

        // Show success message
        toast.success('Login successful!');
      }
    }
  }, [location, navigate]);

  return null;
}

export default function Root() {
  const [currentUser, setCurrentUser] = useState(() => {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      console.log('Storage change detected, updating user state');
      const user = localStorage.getItem('currentUser');
      setCurrentUser(user ? JSON.parse(user) : null);
    };

    // Listen for storage events
    window.addEventListener('storage', handleStorageChange);

    // Run once on mount to ensure state is initialized
    handleStorageChange();

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Debug: Log current user state when it changes
  useEffect(() => {
    console.log('Current user state:', currentUser);
  }, [currentUser]);

  return (
    <Router>
      <Navbar />
      <ToastContainer position="top-right" autoClose={3000} />
      <CasLoginHandler />
      <NetworkStatus />
      <Routes>
        <Route path="/" element={currentUser ? <App /> : <Navigate to="/login" />} />
        <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={currentUser ? <Navigate to="/" /> : <Signup />} />
        <Route path="/profile" element={currentUser ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/generateTimeTables" element={currentUser ? <GenerateTimeTables /> : <Navigate to="/login" />} />
        <Route path="/viewTimeTables" element={currentUser ? <ViewTimeTables /> : <Navigate to="/login" />} />
        <Route path="/generate" element={currentUser ? <GenerateTimeTables /> : <Navigate to="/login" />} />
        <Route path="/student-statistics" element={currentUser ? <StudentStatistics /> : <Navigate to="/login" />} />
        <Route path="/generateSeatingArrangements" element={currentUser ? <GenerateSeatingArrangements /> : <Navigate to="/login" />} />
        <Route path="/viewSeatingArrangement" element={currentUser ? <ViewSeatingArrangement /> : <Navigate to="/login" />} />
        <Route path="/generateInvigilation" element={currentUser ? <GenerateInvigilation /> : <Navigate to="/login" />} />
        <Route path="/viewInvigilation" element={currentUser ? <ViewInvigilation /> : <Navigate to="/login" />} />
        <Route path="/api/cas/callback" element={<CasCallback />} />
        <Route path="/cas-success" element={<CasSuccessHandler />} />
        <Route path="*" element={<Notfound />} />
      </Routes>
    </Router>
  );
}