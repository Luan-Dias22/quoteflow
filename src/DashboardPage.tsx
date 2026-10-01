import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  Wrench, 
  MessageSquare, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  Bell,
  Volume2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { useNotifications } from './contexts/NotificationContext';
import { Card, Button } from './components/UI';
import { Supplier, Tool, Quotation } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTheme } from './contexts/ThemeContext';
import { cn } from './lib/utils';
import { WhatsAppIcon } from './components/WhatsAppTemplateModal';

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { 
    permission, 
    requestPermission, 
    notifications, 
    unreadCount, 
    triggerTestWhatsAppNotification 
  } = useNotifications();
  const [activityTab, setActivityTab] = useState<'whatsapp' | 'envios'>('whatsapp');
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

        // Chart data (last 7 days evolution: enviadas vs respondidas)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          d.setHours(0, 0, 0, 0);
          return d;
        });

        const data = last7Days.map(dateObj => {
          const dayKey = format(dateObj, 'dd/MM');
          const dayOfWeek = format(dateObj, 'EEE', { locale: ptBR });
          const fullDate = format(dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR });

          // Quotations created/sent on this day (excluding local drafts)
          const dayQuotes = quotations.filter(q => {
            try {
              if (!q.createdAt) return false;
              const qDate = new Date(q.createdAt);
              if (isNaN(qDate.getTime())) return false;
              const isSent = q.status ? q.status !== 'Rascunho' : true;
              return format(qDate, 'dd/MM') === dayKey && isSent;
            } catch {
              return false;
            }
          });

          const enviadas = dayQuotes.length;
          const respondidas = dayQuotes.filter(q => q.status === 'Respondido' || q.status === 'Negociando').length;
          const taxa = enviadas > 0 ? Math.round((respondidas / enviadas) * 100) : 0;

          return {
            name: `${dayKey} (${dayOfWeek})`,
            shortDate: dayKey,
            dayOfWeek,
            fullDate,
            enviadas,
            respondidas,
            taxa
          };
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

  const weekTotals = useMemo(() => {
    const totalEnviadas = chartData.reduce((acc, curr) => acc + (curr.enviadas || 0), 0);
    const totalRespondidas = chartData.reduce((acc, curr) => acc + (curr.respondidas || 0), 0);
    const taxaSemana = totalEnviadas > 0 ? Math.round((totalRespondidas / totalEnviadas) * 100) : 0;
    return { totalEnviadas, totalRespondidas, taxaSemana };
  }, [chartData]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Data inválida';
      return format(date, "dd 'de' MMM", { locale: ptBR });
    } catch {
      return 'Erro na data';
    }
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 text-xs space-y-2.5 min-w-[190px]">
          <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white pb-1.5 border-b border-gray-100 dark:border-slate-800 capitalize">
            <Calendar size={13} className="text-[#0EA5E9]" />
            <span>{item.fullDate || label}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9] shadow-xs" />
                Cotações Enviadas:
              </span>
              <span className="font-extrabold text-gray-900 dark:text-white">{item.enviadas}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-xs" />
                Respondidas:
              </span>
              <span className="font-extrabold text-gray-900 dark:text-white">{item.respondidas}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-dashed border-gray-100 dark:border-slate-800">
              <span className="text-gray-500 dark:text-slate-400">Taxa de retorno:</span>
              <span className={cn(
                "font-black text-xs px-1.5 py-0.5 rounded",
                item.taxa >= 70 ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" :
                item.taxa >= 40 ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" :
                "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
              )}>
                {item.taxa}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
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
      <div className="flex h-full items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0EA5E9] border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-slate-400 animate-pulse">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Push Notification System Alert Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#25D366]/30">
            <WhatsAppIcon className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-base text-gray-900 dark:text-white">
                Notificações Push • Retorno de Cotações WhatsApp
              </h4>
              <span className={cn(
                "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1",
                permission === 'granted' 
                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : permission === 'denied'
                  ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
              )}>
                {permission === 'granted' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {permission === 'granted' ? 'Alertas Ativos' : permission === 'denied' ? 'Bloqueado' : 'Aguardando Permissão'}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              O sistema monitora respostas em tempo real. Você recebe alertas instantâneos com som e notificação push quando uma nova cotação for recebida via WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {permission !== 'granted' && (
            <Button
              onClick={requestPermission}
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white border-none gap-2 text-xs font-bold shadow-xs"
            >
              <Bell size={14} />
              Ativar Notificações Push
            </Button>
          )}
          <Button
            variant="outline"
            onClick={triggerTestWhatsAppNotification}
            className="gap-2 text-xs font-semibold"
            title="Testa o alerta sonoro, pop-up em tela e notificação push"
          >
            <Volume2 size={14} className="text-[#0EA5E9]" />
            Simular Cotação Recebida
          </Button>
        </div>
      </div>

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
        {/* Visual Widget: Recharts Daily Evolution Chart (Enviadas vs Respondidas) */}
        <Card className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Evolução Diária de Cotações
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#0EA5E9] border border-blue-100 dark:border-blue-800/30">
                    Última Semana
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Comparativo diário entre cotações enviadas aos fornecedores e retornos respondidos.
                </p>
              </div>

              {/* Quick Summary Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/30 text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#0EA5E9]"></span>
                  <span className="text-sky-700 dark:text-sky-300 font-medium">Enviadas:</span>
                  <span className="font-extrabold text-sky-900 dark:text-white">{weekTotals.totalEnviadas}</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">Respondidas:</span>
                  <span className="font-extrabold text-emerald-900 dark:text-white">{weekTotals.totalRespondidas}</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/30 text-xs">
                  <TrendingUp size={13} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-purple-700 dark:text-purple-300 font-medium">Retorno:</span>
                  <span className="font-extrabold text-purple-900 dark:text-white">{weekTotals.taxaSemana}%</span>
                </div>
              </div>
            </div>

            <div className="h-[310px] w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={6}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke={theme === 'dark' ? '#1E293B' : '#F1F5F9'} 
                  />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: theme === 'dark' ? '#94A3B8' : '#64748B', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis 
                    allowDecimals={false}
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: theme === 'dark' ? '#94A3B8' : '#64748B', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomChartTooltip />} cursor={{ fill: theme === 'dark' ? '#1E293B40' : '#F8FAFC' }} />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: '16px' }}
                    formatter={(value) => (
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 ml-1">
                        {value === 'enviadas' ? 'Cotações Enviadas' : 'Cotações Respondidas'}
                      </span>
                    )}
                  />
                  <Bar 
                    dataKey="enviadas" 
                    name="enviadas" 
                    fill="#0EA5E9" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={28}
                  />
                  <Bar 
                    dataKey="respondidas" 
                    name="respondidas" 
                    fill="#10B981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Activity & WhatsApp Alerts Feed */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setActivityTab('whatsapp')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                    activityTab === 'whatsapp'
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
                  )}
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                  Alertas WhatsApp
                  {unreadCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActivityTab('envios')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                    activityTab === 'envios'
                      ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                      : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
                  )}
                >
                  <MessageSquare size={13} />
                  Últimos Envios
                </button>
              </div>

              {activityTab === 'whatsapp' && (
                <button
                  onClick={triggerTestWhatsAppNotification}
                  title="Simular teste de alerta"
                  className="text-[11px] text-[#0EA5E9] hover:underline font-semibold"
                >
                  + Testar
                </button>
              )}
            </div>

            {/* Tab 1: WhatsApp Alerts Feed */}
            {activityTab === 'whatsapp' && (
              <div className="space-y-3.5">
                {notifications.filter(n => n.type === 'whatsapp_quote').length > 0 ? (
                  notifications
                    .filter(n => n.type === 'whatsapp_quote')
                    .slice(0, 5)
                    .map((n) => (
                      <div 
                        key={n.id} 
                        className={cn(
                          "p-3 rounded-xl border transition-all flex items-start gap-3",
                          n.read 
                            ? "border-gray-100 dark:border-slate-800 bg-gray-50/40 dark:bg-slate-800/20" 
                            : "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <WhatsAppIcon className="w-4 h-4 fill-current" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-xs text-gray-900 dark:text-white truncate">
                              {n.supplierName || 'Fornecedor WhatsApp'}
                            </span>
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                              Respondido via WhatsApp
                            </span>
                            <a
                              href="/history"
                              className="text-[11px] text-[#0EA5E9] hover:underline font-semibold flex items-center gap-1"
                            >
                              Ver cotação <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center mx-auto">
                      <WhatsAppIcon className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                        Aguardando retornos via WhatsApp
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 max-w-[220px] mx-auto">
                        Quando um fornecedor responder à sua cotação, você receberá um alerta push instantâneo aqui.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={triggerTestWhatsAppNotification}
                      className="text-xs gap-1.5"
                    >
                      <Volume2 size={13} className="text-[#0EA5E9]" />
                      Simular Recebimento
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Recent Sent Quotations */}
            {activityTab === 'envios' && (
              <div className="space-y-4">
                {recentQuotations.length > 0 ? (
                  recentQuotations.map((q) => (
                    <div key={q.id} className="flex items-start gap-3">
                      <div className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        q.status === 'Respondido' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      )}>
                        {q.status === 'Respondido' ? <CheckCircle2 size={15} /> : <MessageSquare size={15} />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-xs font-bold text-gray-900 dark:text-white">{q.toolName}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">
                          {q.contacts.length} {q.contacts.length === 1 ? 'contato' : 'contatos'} • {formatDate(q.createdAt)}
                        </p>
                      </div>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0',
                        q.status === 'Respondido' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                      )}>
                        {q.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <AlertCircle size={36} className="mb-3 text-gray-200 dark:text-slate-700" />
                    <p className="text-xs text-gray-500 dark:text-slate-400">Nenhuma cotação enviada ainda.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800 text-center">
            <a 
              href="/history" 
              className="text-xs font-semibold text-[#0EA5E9] hover:underline"
            >
              Acessar Histórico Completo de Cotações →
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
