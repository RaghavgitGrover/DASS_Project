import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Signup = () => {
    const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is already logged in
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            toast.error('You are already logged in. Please logout first.');
            navigate('/');
        }
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match!');
        return;
    }

    const payload = { username: formData.username, email: formData.email, password: formData.password };

    try {
        const response = await fetch('http://localhost:3000/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({ message: 'Signup failed. Try again.' }));

        if (!response.ok) {
            toast.error(data.message || 'Signup failed. Please try again.');
            return;
        }

        toast.success('Account created successfully! Please login.');
        navigate('/login');
    } catch (error) {
        console.error('Signup error:', error.message);
        toast.error('An error occurred during signup.');
    }
};


return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16 bg-gray-100">
        <ToastContainer position="top-right" autoClose={3000} />
        <Card className="w-full max-w-sm m-4 shadow-lg">
            <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-center mb-4">Create an Account</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        name="username"
                        placeholder="Username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                    />
                    <Button className="w-full">Sign Up</Button>
                </form>
            </CardContent>
        </Card>
    </div>
);

};

export default Signup;
