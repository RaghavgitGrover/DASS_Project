import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

function CasSuccessHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing authentication...');

  useEffect(() => {
    // Dismiss any existing toasts first
    toast.dismiss();
    
    // Log current URL for debugging
    console.log('CasSuccessHandler processing URL:', window.location.href);
    
    const urlParams = new URLSearchParams(location.search);
    const email = urlParams.get('email');
    const username = urlParams.get('username');

    if (!email || !username) {
      console.error('Missing authentication data:', { email, username });
      setStatus('Authentication failed: Missing user data');
    //   toast.error('Authentication failed: Missing user data');
      
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
      return;
    }

    // Successfully received user data from CAS
    console.log('CAS authentication successful for:', email);
    setStatus('Authentication successful! Redirecting...');
    
    // Clear any existing user data
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentUserEmail');
    localStorage.removeItem('currentUserUsername');
    localStorage.removeItem('timetableState');
    
    // Store user info in localStorage (both ways for compatibility)
    localStorage.setItem('currentUser', JSON.stringify({ email, username }));
    localStorage.setItem('currentUserEmail', email);
    localStorage.setItem('currentUserUsername', username);

    // Trigger storage event for global state update
    window.dispatchEvent(new Event('storage'));

    // Show success message - clear any existing toasts first
    toast.dismiss();
    toast.success('Login successful!');

    // Allow time for state to update before redirecting
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 800);
  }, [location, navigate]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-lg">{status}</p>
        <p className="mt-2 text-sm text-gray-500">You will be redirected automatically.</p>
      </div>
    </div>
  );
}

export default CasSuccessHandler;