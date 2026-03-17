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
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { Button } from './UI';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Fornecedores', path: '/suppliers' },
    { icon: MessageSquare, label: 'Produtos', path: '/tools' },
    { icon: MessageSquare, label: 'Automação', path: '/automation' },
    { icon: History, label: 'Histórico', path: '/history' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex transition-colors duration-300">
        <div className="flex h-20 items-center px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <MessageSquare size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">QuoteFlow</span>
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
                    ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] dark:bg-[#0EA5E9]/20' 
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <item.icon size={20} className={cn('transition-colors', isActive ? 'text-[#0EA5E9]' : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300')} />
                {item.label}
                {isActive && <ChevronRight size={16} className="ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-gray-50 dark:border-slate-800 p-4">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 transform bg-white dark:bg-slate-900 transition-transform duration-300 ease-in-out lg:hidden',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white">
              <MessageSquare size={18} />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">QuoteFlow</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} className="text-gray-500 dark:text-slate-400" />
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
                  isActive ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] dark:bg-[#0EA5E9]/20' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
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
        <header className="flex h-20 items-center justify-between border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 lg:px-10 transition-colors duration-300">
          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} className="text-gray-600 dark:text-slate-400" />
          </button>

          <div className="hidden lg:block">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {menuItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile?.companyName || 'Empresa'}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{profile?.email}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={20} className="text-gray-400 dark:text-slate-500" />
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
