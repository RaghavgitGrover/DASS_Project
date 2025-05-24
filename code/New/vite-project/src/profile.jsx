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

                // Retrieve email from localStorage
                let email = localStorage.getItem('currentUserEmail');
                if (!email) {
                    throw new Error('User email not found in storage');
                }

                console.log('Fetching user details for:', email);

                const response = await fetch(`http://localhost:3000/api/user/${encodeURIComponent(email)}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Failed to fetch user details (Status: ${response.status})`);
                }

                const { user } = await response.json();
                console.log('User details received from API:', user); // Debugging

                // Map API response to expected structure
                const mappedUserDetails = {
                    username: user.name || 'N/A',
                    createdAt: user.createdAt || 'N/A',
                    lastLogin: user.lastLogin || 'N/A',
                };

                setUserDetails(mappedUserDetails);
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

    // Helper function to safely format dates
    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
        } catch (e) {
            return 'N/A';
        }
    };

    // Helper function to safely format date-times
    const formatDateTime = (dateString) => {
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
        } catch (e) {
            return 'N/A';
        }
    };

    // Function to get display name (similar to Navbar logic)
    const getDisplayName = () => {
        if (!userDetails || !userDetails.username) return 'User';
        return userDetails.username.includes('@')
            ? userDetails.username.split('@')[0]
            : userDetails.username;
    };

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

    const avatarInitials = getDisplayName().slice(0, 2).toUpperCase();

    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-4rem)] mt-16 bg-gray-100">
            <Card className="w-full max-w-md m-4 shadow-lg">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center space-y-4">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src="https://github.com/shadcn.png" alt="User avatar" />
                            <AvatarFallback>{avatarInitials}</AvatarFallback>
                        </Avatar>
                        <h2 className="text-2xl font-bold">{getDisplayName()}</h2>
                        <div className="w-full space-y-4">
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                <span className="font-semibold">Member since:</span>
                                <span>{formatDate(userDetails.createdAt)}</span>
                            </div>
                            {userDetails.lastLogin && (
                                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                                    <span className="font-semibold">Last login:</span>
                                    <span>{formatDateTime(userDetails.lastLogin)}</span>
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