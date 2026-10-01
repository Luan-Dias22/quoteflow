import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowUpRight, 
  Award, 
  Zap, 
  MessageCircle, 
  Filter, 
  ChevronRight, 
  FileText, 
  Eye, 
  BarChart3,
  Calendar,
  CheckCircle,
  HelpCircle,
  X,
  Package
} from 'lucide-react';
import { Supplier, Quotation } from '../types';
import { Button, Input, Card, Modal } from './UI';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupplierPerformanceViewProps {
  suppliers: Supplier[];
  quotations: Quotation[];
  onOpenSupplierEdit?: (supplier: Supplier) => void;
}

export interface SupplierStats {
  supplier: Supplier;
  totalQuotations: number;
  sentQuotations: number;
  respondedCount: number;
  negotiatingCount: number;
  pendingCount: number;
  draftCount: number;
  successRate: number | null; // percentage 0-100 or null if 0 sent
  avgResponseTimeMs: number | null;
  formattedAvgResponseTime: string;
  ratingTier: 'excelente' | 'bom' | 'regular' | 'critico' | 'sem_historico';
  quotes: Quotation[];
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return 'N/D';
  const minutes = Math.round(ms / (1000 * 60));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export default function SupplierPerformanceView({
  suppliers,
  quotations,
  onOpenSupplierEdit
}: SupplierPerformanceViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'success_desc' | 'time_asc' | 'quotes_desc' | 'name_asc'>('success_desc');
  const [selectedSupplierForDetails, setSelectedSupplierForDetails] = useState<SupplierStats | null>(null);

  // Calculate statistics for each supplier
  const supplierStatsList: SupplierStats[] = useMemo(() => {
    return suppliers.map(supplier => {
      const cleanPhone = supplier.whatsapp ? supplier.whatsapp.replace(/\D/g, '') : '';
      
      // Match quotations by supplier whatsapp
      const supplierQuotes = quotations.filter(q => {
        if (!q.contacts || q.contacts.length === 0) return false;
        return q.contacts.some(c => {
          const contactClean = c.replace(/\D/g, '');
          return contactClean.length >= 8 && (contactClean === cleanPhone || contactClean.endsWith(cleanPhone) || cleanPhone.endsWith(contactClean));
        });
      });

      const totalQuotations = supplierQuotes.length;
      const sentQuotes = supplierQuotes.filter(q => q.status !== 'Rascunho');
      const respondedQuotes = supplierQuotes.filter(q => q.status === 'Respondido');
      const negotiatingQuotes = supplierQuotes.filter(q => q.status === 'Negociando');
      const pendingQuotes = supplierQuotes.filter(q => q.status === 'Enviado');
      const draftQuotes = supplierQuotes.filter(q => q.status === 'Rascunho');

      const sentCount = sentQuotes.length;
      const successCount = respondedQuotes.length + negotiatingQuotes.length;
      const successRate = sentCount > 0 ? Math.round((successCount / sentCount) * 100) : null;

      // Calculate response times
      const responseTimesMs: number[] = [];
      respondedQuotes.forEach(q => {
        if (q.createdAt && q.updatedAt) {
          const created = new Date(q.createdAt).getTime();
          const updated = new Date(q.updatedAt).getTime();
          const diff = updated - created;
          if (diff > 0 && !isNaN(diff)) {
            responseTimesMs.push(diff);
          }
        }
      });

      const avgResponseTimeMs = responseTimesMs.length > 0 
        ? Math.round(responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length)
        : null;

      // Determine rating tier
      let ratingTier: SupplierStats['ratingTier'] = 'sem_historico';
      if (sentCount === 0) {
        ratingTier = 'sem_historico';
      } else if (successRate !== null) {
        if (successRate >= 80) ratingTier = 'excelente';
        else if (successRate >= 60) ratingTier = 'bom';
        else if (successRate >= 40) ratingTier = 'regular';
        else ratingTier = 'critico';
      }

      return {
        supplier,
        totalQuotations,
        sentQuotations: sentCount,
        respondedCount: respondedQuotes.length,
        negotiatingCount: negotiatingQuotes.length,
        pendingCount: pendingQuotes.length,
        draftCount: draftQuotes.length,
        successRate,
        avgResponseTimeMs,
        formattedAvgResponseTime: formatDuration(avgResponseTimeMs),
        ratingTier,
        quotes: supplierQuotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      };
    });
  }, [suppliers, quotations]);

  // Overall KPI metrics
  const overallKPIs = useMemo(() => {
    const activeSuppliers = supplierStatsList.filter(s => s.sentQuotations > 0);
    const totalSent = activeSuppliers.reduce((acc, s) => acc + s.sentQuotations, 0);
    const totalResponded = activeSuppliers.reduce((acc, s) => acc + s.respondedCount + s.negotiatingCount, 0);
    const overallSuccessRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;

    // Fastest supplier (with recorded response time)
    const suppliersWithTime = supplierStatsList.filter(s => s.avgResponseTimeMs !== null && s.avgResponseTimeMs > 0);
    suppliersWithTime.sort((a, b) => (a.avgResponseTimeMs || 0) - (b.avgResponseTimeMs || 0));
    const fastestSupplier = suppliersWithTime.length > 0 ? suppliersWithTime[0] : null;

    // Top success rate supplier (min 1 quote sent)
    const suppliersWithQuotes = [...activeSuppliers].sort((a, b) => {
      const rateA = a.successRate ?? -1;
      const rateB = b.successRate ?? -1;
      if (rateB !== rateA) return rateB - rateA;
      return b.sentQuotations - a.sentQuotations;
    });
    const topSupplier = suppliersWithQuotes.length > 0 && suppliersWithQuotes[0].successRate !== null ? suppliersWithQuotes[0] : null;

    // Average response time overall
    const allTimes: number[] = [];
    supplierStatsList.forEach(s => {
      s.quotes.forEach(q => {
        if (q.status === 'Respondido' && q.createdAt && q.updatedAt) {
          const diff = new Date(q.updatedAt).getTime() - new Date(q.createdAt).getTime();
          if (diff > 0) allTimes.push(diff);
        }
      });
    });
    const overallAvgTimeMs = allTimes.length > 0 ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length) : null;

    return {
      totalSent,
      overallSuccessRate,
      fastestSupplier,
      topSupplier,
      formattedOverallAvgTime: formatDuration(overallAvgTimeMs)
    };
  }, [supplierStatsList]);

  // Filtered and sorted list
  const filteredAndSortedStats = useMemo(() => {
    return supplierStatsList.filter(item => {
      const matchSearch = 
        item.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.company.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchSearch) return false;

      if (tierFilter === 'all') return true;
      if (tierFilter === 'excelente') return item.ratingTier === 'excelente';
      if (tierFilter === 'bom') return item.ratingTier === 'bom';
      if (tierFilter === 'critico') return item.ratingTier === 'critico' || item.ratingTier === 'regular';
      if (tierFilter === 'sem_historico') return item.ratingTier === 'sem_historico';
      return true;
    }).sort((a, b) => {
      if (sortBy === 'success_desc') {
        const rateA = a.successRate !== null ? a.successRate : -1;
        const rateB = b.successRate !== null ? b.successRate : -1;
        if (rateB !== rateA) return rateB - rateA;
        return b.sentQuotations - a.sentQuotations;
      }
      if (sortBy === 'time_asc') {
        const timeA = a.avgResponseTimeMs !== null ? a.avgResponseTimeMs : Number.MAX_SAFE_INTEGER;
        const timeB = b.avgResponseTimeMs !== null ? b.avgResponseTimeMs : Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      }
      if (sortBy === 'quotes_desc') {
        return b.sentQuotations - a.sentQuotations;
      }
      if (sortBy === 'name_asc') {
        return a.supplier.name.localeCompare(b.supplier.name);
      }
      return 0;
    });
  }, [supplierStatsList, searchTerm, tierFilter, sortBy]);

  const getTierBadge = (tier: SupplierStats['ratingTier'], rate: number | null) => {
    switch (tier) {
      case 'excelente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Excelente ({rate}%)
          </span>
        );
      case 'bom':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            Bom ({rate}%)
          </span>
        );
      case 'regular':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            Regular ({rate}%)
          </span>
        );
      case 'critico':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
            Atenção ({rate}%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
            Sem histórico
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Highlights KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Overall Success Rate */}
        <Card className="p-5 border-none shadow-sm bg-gradient-to-br from-emerald-500/10 via-white dark:via-slate-900 to-white dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Taxa Geral de Retorno
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {overallKPIs.overallSuccessRate}%
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              de sucesso nas cotações
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {overallKPIs.totalSent} cotações enviadas no total
          </p>
        </Card>

        {/* KPI 2: Overall Average Response Time */}
        <Card className="p-5 border-none shadow-sm bg-gradient-to-br from-blue-500/10 via-white dark:via-slate-900 to-white dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0EA5E9] dark:text-blue-400">
              Tempo Médio de Resposta
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-[#0EA5E9]">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {overallKPIs.formattedOverallAvgTime}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Média entre envio e resposta
          </p>
        </Card>

        {/* KPI 3: Top Performer */}
        <Card className="p-5 border-none shadow-sm bg-gradient-to-br from-purple-500/10 via-white dark:via-slate-900 to-white dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Maior Taxa de Retorno
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
              <Award size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate block">
              {overallKPIs.topSupplier ? overallKPIs.topSupplier.supplier.name : 'Nenhum'}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500 dark:text-slate-400 truncate">
                {overallKPIs.topSupplier ? overallKPIs.topSupplier.supplier.company : '-'}
              </span>
              {overallKPIs.topSupplier && overallKPIs.topSupplier.successRate !== null && (
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                  {overallKPIs.topSupplier.successRate}%
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* KPI 4: Fastest Supplier */}
        <Card className="p-5 border-none shadow-sm bg-gradient-to-br from-amber-500/10 via-white dark:via-slate-900 to-white dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Mais Rápido no Retorno
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <Zap size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate block">
              {overallKPIs.fastestSupplier ? overallKPIs.fastestSupplier.supplier.name : 'Nenhum'}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500 dark:text-slate-400 truncate">
                {overallKPIs.fastestSupplier ? overallKPIs.fastestSupplier.supplier.company : '-'}
              </span>
              {overallKPIs.fastestSupplier && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">
                  ~{overallKPIs.fastestSupplier.formattedAvgResponseTime}
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input 
            placeholder="Buscar por nome ou empresa..." 
            className="pl-9 h-10 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tier Filter */}
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 p-1 rounded-xl text-xs">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'excelente', label: 'Excelente' },
              { id: 'bom', label: 'Bom' },
              { id: 'critico', label: 'Atenção' },
              { id: 'sem_historico', label: 'Sem Histórico' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTierFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors",
                  tierFilter === tab.id
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs font-bold"
                    : "text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <select 
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="h-10 px-3 text-xs font-medium rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="success_desc">Maior Taxa de Sucesso</option>
            <option value="time_asc">Menor Tempo de Resposta</option>
            <option value="quotes_desc">Mais Cotações Enviadas</option>
            <option value="name_asc">Nome (A - Z)</option>
          </select>
        </div>
      </div>

      {/* Supplier Performance Table */}
      <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4">Taxa de Sucesso</th>
                <th className="px-6 py-4">Tempo Médio</th>
                <th className="px-6 py-4">Cotações / Retornos</th>
                <th className="px-6 py-4">Avaliação</th>
                <th className="px-6 py-4 text-right">Histórico & Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredAndSortedStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <BarChart3 className="mx-auto h-12 w-12 opacity-20 mb-3" />
                    <p className="font-semibold text-gray-600 dark:text-slate-400">Nenhum fornecedor encontrado</p>
                    <p className="text-xs">Tente ajustar seus filtros de busca.</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedStats.map(stat => {
                  const s = stat.supplier;
                  const rate = stat.successRate;

                  return (
                    <tr 
                      key={s.id} 
                      className="group hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Supplier Column */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {s.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-500">
                          {s.company}
                        </div>
                        {s.whatsapp && (
                          <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                            {s.whatsapp}
                          </div>
                        )}
                      </td>

                      {/* Success Rate Column with Progress Bar */}
                      <td className="px-6 py-4 min-w-[180px]">
                        {rate !== null ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-black text-gray-900 dark:text-white">{rate}%</span>
                              <span className="text-[11px] text-gray-400">
                                {stat.respondedCount + stat.negotiatingCount}/{stat.sentQuotations}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  rate >= 80 ? "bg-emerald-500" :
                                  rate >= 60 ? "bg-blue-500" :
                                  rate >= 40 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${Math.min(100, Math.max(5, rate))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sem cotações enviadas</span>
                        )}
                      </td>

                      {/* Average Response Time Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Clock size={15} className={cn(
                            stat.avgResponseTimeMs !== null ? "text-[#0EA5E9]" : "text-gray-300 dark:text-slate-700"
                          )} />
                          <span className={cn(
                            "font-bold text-sm",
                            stat.avgResponseTimeMs !== null ? "text-gray-900 dark:text-white" : "text-gray-400 text-xs font-normal"
                          )}>
                            {stat.formattedAvgResponseTime}
                          </span>
                        </div>
                        {stat.avgResponseTimeMs !== null && (
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            baseado em {stat.respondedCount} retorno(s)
                          </span>
                        )}
                      </td>

                      {/* Breakdown Counts */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span title="Respondidos" className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            {stat.respondedCount}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span title="Em Negociação" className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                            {stat.negotiatingCount}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span title="Pendentes de Retorno" className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                            {stat.pendingCount}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          Total: {stat.sentQuotations} enviada(s)
                        </span>
                      </td>

                      {/* Tier Badge */}
                      <td className="px-6 py-4">
                        {getTierBadge(stat.ratingTier, rate)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.whatsapp && (
                            <a
                              href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Conversar no WhatsApp"
                              className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                            >
                              <MessageCircle size={16} />
                            </a>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSupplierForDetails(stat)}
                            className="gap-1.5 text-xs h-8"
                          >
                            <Eye size={13} />
                            Detalhes
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Supplier Performance Details Modal */}
      {selectedSupplierForDetails && (
        <Modal
          isOpen={!!selectedSupplierForDetails}
          onClose={() => setSelectedSupplierForDetails(null)}
          title={`Desempenho: ${selectedSupplierForDetails.supplier.name}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">
                {selectedSupplierForDetails.quotes.length} registro(s) no histórico
              </span>
              <div className="flex gap-2">
                {selectedSupplierForDetails.supplier.whatsapp && (
                  <a
                    href={`https://wa.me/${selectedSupplierForDetails.supplier.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#20ba5a] text-white transition-colors"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelectedSupplierForDetails(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Supplier Quick Card Header */}
            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-extrabold text-base text-gray-900 dark:text-white">
                  {selectedSupplierForDetails.supplier.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {selectedSupplierForDetails.supplier.company} • {selectedSupplierForDetails.supplier.whatsapp}
                </p>
                {selectedSupplierForDetails.supplier.email && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedSupplierForDetails.supplier.email}
                  </p>
                )}
              </div>

              <div>
                {getTierBadge(selectedSupplierForDetails.ratingTier, selectedSupplierForDetails.successRate)}
              </div>
            </div>

            {/* Performance KPIs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">
                  Taxa de Retorno
                </span>
                <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1 block">
                  {selectedSupplierForDetails.successRate !== null ? `${selectedSupplierForDetails.successRate}%` : 'N/D'}
                </span>
                <span className="text-[10px] text-emerald-600/80">
                  {selectedSupplierForDetails.respondedCount + selectedSupplierForDetails.negotiatingCount} respondidas
                </span>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <span className="text-[11px] font-bold text-[#0EA5E9] dark:text-blue-400 block uppercase">
                  Tempo Médio
                </span>
                <span className="text-2xl font-black text-blue-900 dark:text-blue-300 mt-1 block">
                  {selectedSupplierForDetails.formattedAvgResponseTime}
                </span>
                <span className="text-[10px] text-blue-500/80">
                  desde o envio
                </span>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block uppercase">
                  Pendentes
                </span>
                <span className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1 block">
                  {selectedSupplierForDetails.pendingCount}
                </span>
                <span className="text-[10px] text-amber-600/80">
                  aguardando resposta
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400 block uppercase">
                  Total Enviadas
                </span>
                <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">
                  {selectedSupplierForDetails.sentQuotations}
                </span>
                <span className="text-[10px] text-gray-400">
                  cotações ativas
                </span>
              </div>
            </div>

            {/* Quotation History List */}
            <div className="space-y-3">
              <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar size={16} className="text-[#0EA5E9]" />
                Histórico de Cotações com este Fornecedor ({selectedSupplierForDetails.quotes.length})
              </h5>

              {selectedSupplierForDetails.quotes.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Nenhuma cotação registrada com este fornecedor ainda.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {selectedSupplierForDetails.quotes.map(q => {
                    const createdDate = q.createdAt ? format(new Date(q.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-';
                    let responseDurationStr = null;
                    if (q.status === 'Respondido' && q.createdAt && q.updatedAt) {
                      const diff = new Date(q.updatedAt).getTime() - new Date(q.createdAt).getTime();
                      if (diff > 0) responseDurationStr = formatDuration(diff);
                    }

                    return (
                      <div 
                        key={q.id}
                        className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 dark:text-white">
                              {q.toolName || (q.items && q.items.length > 0 ? `${q.items.length} itens cotados` : 'Cotação')}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              q.status === 'Respondido' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                              q.status === 'Negociando' && "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                              q.status === 'Enviado' && "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
                              q.status === 'Rascunho' && "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              {q.status}
                            </span>
                          </div>

                          {q.items && q.items.length > 0 && (
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-1">
                              {q.items.map(it => `${it.quantity}x ${it.toolName}`).join(', ')}
                            </p>
                          )}

                          <p className="text-[10px] text-gray-400">
                            Enviado em: {createdDate}
                          </p>
                        </div>

                        {responseDurationStr && (
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center sm:justify-end gap-1">
                              <Clock size={12} />
                              Respondido em {responseDurationStr}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
