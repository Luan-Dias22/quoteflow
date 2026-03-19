import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Wrench, 
  MessageSquare, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Card } from './components/UI';
import { Supplier, Tool, Quotation } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    suppliers: 0,
    tools: 0,
    quotations: 0,
    quotations7Days: 0,
    responseRate7Days: 0,
    negotiationRate7Days: 0
  });
  const [recentQuotations, setRecentQuotations] = useState<Quotation[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        // Fetch counts
        const suppliersSnap = await getDocs(query(collection(db, 'suppliers'), where('userId', '==', user.uid)));
        const toolsSnap = await getDocs(query(collection(db, 'tools'), where('userId', '==', user.uid)));
        const quotationsSnap = await getDocs(query(collection(db, 'quotations'), where('userId', '==', user.uid)));

        const quotations = quotationsSnap.docs.map(doc => doc.data() as Quotation);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const quotations7Days = quotations.filter(q => {
          try {
            const date = new Date(q.createdAt);
            return date >= sevenDaysAgo;
          } catch {
            return false;
          }
        });

        const total7Days = quotations7Days.length;
        const responded7Days = quotations7Days.filter(q => q.status === 'Respondido' || q.status === 'Negociando').length;
        const negotiating7Days = quotations7Days.filter(q => q.status === 'Negociando').length;

        setStats({
          suppliers: suppliersSnap.size,
          tools: toolsSnap.size,
          quotations: quotationsSnap.size,
          quotations7Days: total7Days,
          responseRate7Days: total7Days > 0 ? Math.round((responded7Days / total7Days) * 100) : 0,
          negotiationRate7Days: total7Days > 0 ? Math.round((negotiating7Days / total7Days) * 100) : 0
        });

        // Recent quotations
        const recentSnap = await getDocs(query(
          collection(db, 'quotations'), 
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        ));
        setRecentQuotations(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation)));

        // Chart data (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return format(d, 'dd/MM');
        }).reverse();

        const data = last7Days.map(day => {
          const count = quotations.filter(q => {
            try {
              const date = new Date(q.createdAt);
              if (isNaN(date.getTime())) return false;
              return format(date, 'dd/MM') === day;
            } catch {
              return false;
            }
          }).length;
          return { name: day, total: count };
        });
        setChartData(data);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Data inválida';
      return format(date, "dd 'de' MMM", { locale: ptBR });
    } catch {
      return 'Erro na data';
    }
  };

  const statCards = [
    { label: 'Total Fornecedores', value: stats.suppliers, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Total Ferramentas', value: stats.tools, icon: Wrench, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Cotações (Total)', value: stats.quotations, icon: MessageSquare, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Cotações (7 dias)', value: stats.quotations7Days, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Taxa Resposta (7d)', value: `${stats.responseRate7Days}%`, icon: TrendingUp, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Taxa Negociação (7d)', value: `${stats.negotiationRate7Days}%`, icon: BarChart3, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0EA5E9] border-t-transparent" />
          <p className="text-sm text-gray-500 animate-pulse">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, i) => (
          <Card key={i} className="p-6 transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', stat.bg, stat.color)}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Chart */}
        <Card className="lg:col-span-2 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cotações Enviadas (7 dias)</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <Clock size={16} />
              <span>Atualizado agora</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-slate-800" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC', className: 'dark:fill-slate-800/50' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: '#FFFFFF',
                  }}
                  itemStyle={{ color: '#0EA5E9' }}
                  labelStyle={{ color: '#64748B', fontWeight: 'bold' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#0EA5E9' : '#E2E8F0'} className={index === chartData.length - 1 ? '' : 'dark:fill-slate-800'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h3 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Últimos Envios</h3>
          <div className="space-y-6">
            {recentQuotations.length > 0 ? (
              recentQuotations.map((q) => (
                <div key={q.id} className="flex items-start gap-4">
                  <div className={cn(
                    'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    q.status === 'Respondido' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  )}>
                    {q.status === 'Respondido' ? <CheckCircle2 size={16} /> : <MessageSquare size={16} />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{q.toolName}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {q.contacts.length} {q.contacts.length === 1 ? 'contato' : 'contatos'} • {formatDate(q.createdAt)}
                    </p>
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    q.status === 'Respondido' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                  )}>
                    {q.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertCircle size={40} className="mb-4 text-gray-200 dark:text-slate-700" />
                <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma cotação enviada ainda.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

import { cn } from './lib/utils';
