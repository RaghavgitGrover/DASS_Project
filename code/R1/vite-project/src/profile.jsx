import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const [userDetails, setUserDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Try to get email from both storage formats for compatibility
                let email = localStorage.getItem('currentUserEmail');
                if (!email) {
                    const userData = localStorage.getItem('currentUser');
                    if (userData) {
                        const user = JSON.parse(userData);
                        email = user?.email;
                        
                        // Also store it in the other format for future use
                        if (email) {
                            localStorage.setItem('currentUserEmail', email);
                        }
                    }
                }
                
                if (!email) {
                    throw new Error('User email not found in storage');
                }
                
                console.log('Fetching user details for:', email);
                
                const response = await fetch(`http://localhost:3000/api/user/${email}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch user details');
                }
                
                const data = await response.json();
                setUserDetails(data);
                
            } catch (error) {
                console.error('Error fetching user details:', error);
                setError(error.message);
                toast.error(`Error: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchUserDetails();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-lg">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16">
                <div className="text-center bg-red-50 p-8 rounded-lg shadow-md max-w-md w-full">
                    <p className="text-lg text-red-600 font-medium">Error loading profile</p>
                    <p className="mt-2 text-red-500">{error}</p>
                    <div className="mt-6 flex gap-4 justify-center">
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        >
                            Try Again
                        </button>
                        <button 
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!userDetails) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16">
                <div className="text-center">
                    <p className="text-lg">No user details found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-4rem)] mt-16 bg-gray-100">
            <Card className="w-full max-w-md m-4">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center space-y-4">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>
                                {userDetails.username?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <h2 className="text-2xl font-bold">{userDetails.username}</h2>
                        <div className="w-full space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">Email:</span>
                                <span>{userDetails.email}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">Member since:</span>
                                <span>{new Date(userDetails.createdAt).toLocaleDateString()}</span>
                            </div>
                            {userDetails.lastLogin && (
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold">Last login:</span>
                                    <span>{new Date(userDetails.lastLogin).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Profile;