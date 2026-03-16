import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  MessageSquare, 
  History, 
  User, 
  LogOut, 
  Menu, 
  X,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { Button } from './UI';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Fornecedores', path: '/suppliers' },
    { icon: Wrench, label: 'Ferramentas', path: '/tools' },
    { icon: MessageSquare, label: 'Automação', path: '/automation' },
    { icon: History, label: 'Histórico', path: '/history' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-100 bg-white lg:flex">
        <div className="flex h-20 items-center px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white shadow-lg shadow-blue-200">
              <Wrench size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">AutoCota</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive 
                    ? 'bg-[#0EA5E9]/10 text-[#0EA5E9]' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon size={20} className={cn('transition-colors', isActive ? 'text-[#0EA5E9]' : 'text-gray-400 group-hover:text-gray-600')} />
                {item.label}
                {isActive && <ChevronRight size={16} className="ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-gray-50 p-4">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-300 ease-in-out lg:hidden',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white">
              <Wrench size={18} />
            </div>
            <span className="text-lg font-bold text-gray-900">AutoCota</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} className="text-gray-500" />
          </button>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                  isActive ? 'bg-[#0EA5E9]/10 text-[#0EA5E9]' : 'text-gray-500 hover:bg-gray-50'
                )}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-20 items-center justify-between border-b border-gray-100 bg-white px-6 lg:px-10">
          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} className="text-gray-600" />
          </button>

          <div className="hidden lg:block">
            <h2 className="text-lg font-semibold text-gray-900">
              {menuItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{profile?.companyName || 'Empresa'}</p>
              <p className="text-xs text-gray-500">{profile?.email}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={20} className="text-gray-400" />
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
