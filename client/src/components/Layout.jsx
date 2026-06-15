import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon, UserGroupIcon, ArrowRightOnRectangleIcon, UserCircleIcon,
} from '@heroicons/react/24/outline';

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <NavLink to="/programs" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="text-2xl">🌱</span> SELP Tracker
          </NavLink>
          <div className="flex items-center gap-4">
            <NavLink to="/programs" className="flex items-center gap-1.5 text-blue-100 hover:text-white text-sm">
              <HomeIcon className="w-4 h-4" /> Programs
            </NavLink>
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <UserCircleIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{user?.fullName}</span>
            </div>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-blue-100 hover:text-white text-sm">
              <ArrowRightOnRectangleIcon className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
