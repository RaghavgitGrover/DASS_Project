import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-toastify';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is already logged in
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            navigate('/');
        }
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        
        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: formData.email, 
                    password: formData.password 
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Login failed. Please check your credentials.');
            }

            // Clear any existing application state before setting new user
            localStorage.removeItem('timetableState');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentUserEmail');
            localStorage.removeItem('currentUserUsername');

            // Store the current user info in localStorage (both ways)
            localStorage.setItem('currentUser', JSON.stringify({
                email: formData.email,
                username: data.username
            }));
            localStorage.setItem('currentUserEmail', formData.email);
            localStorage.setItem('currentUserUsername', data.username);

            // Trigger storage event for other components
            window.dispatchEvent(new Event('storage'));

            toast.success('Login successful! Welcome back.');
            
            // Small delay to ensure state is updated
            setTimeout(() => {
                navigate('/', { replace: true });
            }, 100);
            
        } catch (error) {
            toast.error(error.message || 'An error occurred during login.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleCasLogin = (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        
        // Clear any existing user data first
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentUserEmail');
        localStorage.removeItem('currentUserUsername');
        localStorage.removeItem('timetableState');
        
        // Use setTimeout to ensure the localStorage is cleared
        setTimeout(() => {
            // Direct browser to CAS login endpoint on the server
            window.location.href = 'http://localhost:3000/api/cas/login';
        }, 100);
    };

    return (
        <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16 bg-gray-100">
            <Card className="w-full max-w-sm m-4 shadow-lg">
                <CardContent className="p-6">
                    <h2 className="text-2xl font-bold text-center mb-4">Sign In</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            disabled={isLoggingIn}
                        />
                        <Input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            disabled={isLoggingIn}
                        />
                        <Button className="w-full" disabled={isLoggingIn}>
                            {isLoggingIn ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </form>

                    <div className="my-4 relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleCasLogin}
                        variant="outline"
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
                        disabled={isLoggingIn}
                    >
                        {isLoggingIn ? 'Redirecting...' : 'Sign in with IIIT CAS'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;