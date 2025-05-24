import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const Navbar = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      const user = localStorage.getItem('currentUser');
      setCurrentUser(user ? JSON.parse(user) : null);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    // Prevent multiple clicks
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    // Clear all application state
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentUserEmail');
    localStorage.removeItem('currentUserUsername');
    localStorage.removeItem('timetableState');

    // Update UI immediately
    setCurrentUser(null);

    // Force a global state update
    window.dispatchEvent(new Event('storage'));

    // Small delay before redirect to ensure state is updated
    setTimeout(() => {
      // Navigate to login page with replace to prevent back navigation
      navigate('/login', { replace: true });
      setIsLoggingOut(false);
    }, 200);
  };

  // Function to get display name (username without domain)
  const getDisplayName = () => {
    if (!currentUser) return '';

    // If username exists, check if it contains @ and extract just the name part
    if (currentUser.username) {
      return currentUser.username.includes('@')
        ? currentUser.username.split('@')[0]
        : currentUser.username;
    }

    // Fallback to email if username doesn't exist
    if (currentUser.email) {
      return currentUser.email.split('@')[0];
    }

    // Default fallback
    return 'user';
  };

  // Function to get avatar initials
  const getAvatarInitials = () => {
    const displayName = getDisplayName();
    return displayName ? displayName.slice(0, 2).toUpperCase() : 'HD';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 flex items-center h-16 px-4 bg-gray-800 text-white z-50">
      {currentUser ? (
        <>
          <div className="flex items-center space-x-2">
            <Link to="/profile" className="flex items-center space-x-2 hover:text-gray-300">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>{getAvatarInitials()}</AvatarFallback>
              </Avatar>
              <span>{getDisplayName()}</span>
            </Link>
          </div>
          <div className="flex-1" />
          <div className="flex items-center space-x-6">
            <Link to="/" className="hover:text-gray-300">Home</Link>
            <Link to="/generateTimeTables" className="hover:text-gray-300">Generate Timetable</Link>
            <Link to="/viewTimeTables" className="hover:text-gray-300">View Timetables</Link>
            <Link to="/generateSeatingArrangements" className="hover:text-gray-300">Generate Seating Arrangement</Link>
            <Link to="/viewSeatingArrangement" className="hover:text-gray-300">View Seating Arrangements</Link>
            <Link to="/generateInvigilation" className="hover:text-gray-300">Generate Invigilation</Link>
            <Link to="/viewInvigilation" className="hover:text-gray-300">View Invigilation</Link>
            <button
              onClick={handleLogout}
              className={`bg-red-500 hover:bg-red-600 rounded px-3 py-1 transition-colors ${isLoggingOut ? 'opacity-70 cursor-not-allowed' : ''}`}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1" />
          <div className="flex items-center space-x-6">
            <Link to="/login" className="hover:text-gray-300 transition-colors">Login</Link>
            <Link to="/signup" className="hover:text-gray-300 transition-colors">Signup</Link>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar;