import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

const CasCallback = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState('Processing CAS authentication...');

    useEffect(() => {
        // Dismiss any existing toasts first
        toast.dismiss();
        
        // Log current URL for debugging
        console.log('CasCallback component loaded with URL:', window.location.href);
        
        const urlParams = new URLSearchParams(location.search);
        const ticket = urlParams.get('ticket');
        const email = urlParams.get('email');
        const username = urlParams.get('username');

        console.log('Ticket param:', ticket);
        console.log('Email param:', email);
        console.log('Username param:', username);

        if (ticket && !email && !username) {
            // If we only have a ticket, we need to process it
            setStatus('Validating CAS ticket...');
            processCasTicket(ticket);
        } else if (email && username) {
            // We already have the user info, just set it and redirect
            setStatus('Authentication successful! Redirecting...');
            completeLogin(email, username);
        } else {
            console.error('Invalid authentication data');
            setStatus('Authenticating failed: Missing data');
            toast.dismiss();
            toast.error('Invalid authentication data');
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 1500);
        }
    }, [location, navigate]);

    const processCasTicket = async (ticket) => {
        try {
            console.log('Processing CAS ticket:', ticket);
            setStatus('Validating ticket with server...');
            
            const response = await fetch(`http://localhost:3000/api/cas/validate?ticket=${ticket}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to validate CAS ticket' }));
                throw new Error(errorData.message || 'Failed to validate CAS ticket');
            }
            
            const data = await response.json();
            
            console.log('CAS validation successful:', data);
            setStatus('Ticket validated! Completing login...');
            completeLogin(data.email, data.username);
        } catch (error) 
        {
            console.error('CAS validation error:', error);
            setStatus('Authenticating');
            toast.dismiss();
            // toast.error('Authentication failed: ' + error.message);
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 1500);
        }
    };

    const completeLogin = (email, username) => {
        console.log('Completing login for:', email);
        setStatus('Login successful! Redirecting...');
        
        // Clear any existing state
        localStorage.removeItem('timetableState');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentUserEmail');
        localStorage.removeItem('currentUserUsername');

        // Store user info in localStorage (both formats for compatibility)
        localStorage.setItem('currentUser', JSON.stringify({ email, username }));
        localStorage.setItem('currentUserEmail', email);
        localStorage.setItem('currentUserUsername', username);

        // Force a global state update
        window.dispatchEvent(new Event('storage'));

        // Show success toast - dismiss existing toasts first
        toast.dismiss();
        toast.success('Login successful!');

        // Navigate to home page
        setTimeout(() => {
            navigate('/', { replace: true });
        }, 500);
    };

    return (
        <div className="flex justify-center items-center h-screen">
            <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-lg">{status}</p>
                <p className="mt-2 text-sm text-gray-500">Please wait while we complete the authentication process.</p>
            </div>
        </div>
    );
};

export default CasCallback;