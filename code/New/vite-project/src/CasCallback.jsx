import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

const CasCallback = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState('Processing CAS authentication...');

    useEffect(() => {
        console.log('CasCallback component mounted with URL:', window.location.href);
        
        const urlParams = new URLSearchParams(location.search);
        const ticket = urlParams.get('ticket');
        
        if (!ticket) {
            console.error('No ticket found in URL parameters');
            setStatus('Authentication failed: Missing ticket');
            toast.error('Authentication failed: No ticket found');
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }
        
        // Process the CAS ticket
        const processCasTicket = async () => {
            try {
                console.log('Processing CAS ticket:', ticket);
                setStatus('Validating ticket with server...');
                
                const response = await fetch(`http://localhost:3000/api/cas/validate?ticket=${ticket}`);
                console.log('CAS validation response status:', response.status);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Failed to validate CAS ticket' }));
                    throw new Error(errorData.message || 'Failed to validate CAS ticket');
                }
                
                const data = await response.json();
                console.log('CAS validation response data:', data);
                
                if (!data.success) {
                    throw new Error(data.message || 'CAS authentication failed');
                }
                
                const email = data.email;
                const username = data.username;
                
                console.log(`Authentication successful for ${email} (${username})`);
                setStatus('Authentication successful! Redirecting...');
                
                // Store user info directly in localStorage
                localStorage.removeItem('currentUser');
                localStorage.removeItem('currentUserEmail');
                localStorage.removeItem('currentUserUsername');
                localStorage.removeItem('timetableState');
                
                localStorage.setItem('currentUser', JSON.stringify({ email, username }));
                localStorage.setItem('currentUserEmail', email);
                localStorage.setItem('currentUserUsername', username);
                
                // Force a global state update
                window.dispatchEvent(new Event('storage'));
                
                console.log('User data saved to localStorage, redirecting to home');
                
                // Use direct window location navigation
                setTimeout(() => {
                    window.location.href = '/';
                }, 500);
                
            } catch (error) {
                console.error('CAS validation error:', error);
                setStatus(`Authentication failed: ${error.message}`);
                toast.error(`Authentication failed: ${error.message}`);
                
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            }
        };
        
        processCasTicket();
    }, [location]);

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