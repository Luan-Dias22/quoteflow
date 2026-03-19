import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Trash2, 
  Loader2, 
  AlertCircle,
  Mail,
  Phone,
  User,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  ChevronDown
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Card, Modal } from './components/UI';
import { Lead } from './types';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function LeadsPage() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedLeadMessage, setSelectedLeadMessage] = useState<Lead | null>(null);

  useEffect(() => {
    if (!user) return;

    // If admin, show all leads. Otherwise, show leads for the user and admin_demo leads
    const isAdmin = profile?.role === 'admin' || 
                    user.email === 'luansold@gmail.com' || 
                    user.email === 'luansold@live.com';

    let q;
    if (isAdmin) {
      q = query(collection(db, 'leads'));
    } else {
      q = query(
        collection(db, 'leads'),
        where('userId', 'in', [user.uid, 'admin_demo'])
      );
    }

    console.log("Fetching leads with query for user:", user.uid, "Is Admin:", isAdmin);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        console.log("Leads snapshot received, count:", snapshot.size);
        const leadsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Ensure createdAt is a string or handle timestamp
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            name: data.name || 'Sem nome',
            email: data.email || 'Sem e-mail',
            phone: data.phone || 'Sem telefone',
            message: data.message || '',
            source: data.source || 'Desconhecida',
            status: (data.status === 'Novo' ? 'Novo Pedido' : 
                     data.status === 'Em Contato' ? 'Pedido Lançado' :
                     data.status === 'Convertido' ? 'Pedido Concluído' :
                     data.status === 'Perdido' ? 'Pedido Concluído' : 
                     data.status) || 'Novo Pedido'
          };
        }) as Lead[];
        
        // Sort in memory to avoid composite index requirement
        leadsData.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        });
        
        setLeads(leadsData);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error("Error processing leads data:", err);
        setError("Erro ao processar dados dos leads. Verifique o formato dos dados.");
        setLoading(false);
      }
    }, (err) => {
      console.error("Error fetching leads:", err);
      setLoading(false);
      setError("Erro ao carregar leads. Verifique suas permissões.");
      try {
        handleFirestoreError(err, OperationType.GET, 'leads');
      } catch (e) {
        // Error already logged by handleFirestoreError
      }
    });

    return () => unsubscribe();
  }, [user, profile]);

  const handleUpdateStatus = async (leadId: string, newStatus: Lead['status']) => {
    try {
      const leadRef = doc(db, 'leads', leadId);
      await updateDoc(leadRef, { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leads');
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setDeletingId(leadId);
    try {
      await deleteDoc(doc(db, 'leads', leadId));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leads');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      (lead.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone || '').includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Data inválida';
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Erro na data';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
          <p className="text-sm text-gray-500 animate-pulse">Carregando leads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4 border-red-100 bg-red-50/30">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Ops! Algo deu errado</h2>
          <p className="text-sm text-gray-600">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Leads</h1>
          <p className="text-gray-500">Gerencie potenciais clientes e contatos recebidos.</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-slate-700">
              <Filter size={16} />
              <span>Status:</span>
              <select 
                className="bg-transparent border-none focus:ring-0 font-medium text-gray-900 dark:text-white cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="Novo Pedido">Novo Pedido</option>
                <option value="Pedido Lançado">Pedido Lançado</option>
                <option value="Pedido Concluído">Pedido Concluído</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Lead</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Contato</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Mensagem</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Data</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0EA5E9] font-bold">
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{lead.name}</p>
                          <p className="text-xs text-gray-500">{lead.source}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <Mail size={14} />
                          {lead.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <Phone size={14} />
                          {lead.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-gray-600 dark:text-slate-400 max-w-xs truncate" title={lead.message}>
                          {lead.message}
                        </p>
                        {lead.message.length > 40 && (
                          <button 
                            onClick={() => setSelectedLeadMessage(lead)}
                            className="text-[10px] uppercase tracking-wider font-bold text-[#0EA5E9] hover:text-blue-700 transition-colors text-left w-fit"
                          >
                            Ver mensagem completa
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        {formatDate(lead.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                        lead.status === 'Novo Pedido' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        lead.status === 'Pedido Lançado' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                        lead.status === 'Pedido Concluído' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      )}>
                        {lead.status === 'Novo Pedido' && <Clock size={12} />}
                        {lead.status === 'Pedido Lançado' && <MessageSquare size={12} />}
                        {lead.status === 'Pedido Concluído' && <CheckCircle2 size={12} />}
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select 
                          className="text-xs bg-transparent border-none focus:ring-0 text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                          value={lead.status}
                          onChange={(e) => handleUpdateStatus(lead.id!, e.target.value as Lead['status'])}
                        >
                          <option value="Novo Pedido">Marcar Novo Pedido</option>
                          <option value="Pedido Lançado">Marcar Pedido Lançado</option>
                          <option value="Pedido Concluído">Marcar Pedido Concluído</option>
                        </select>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                          onClick={() => setConfirmDelete(lead.id!)}
                          disabled={deletingId === lead.id}
                        >
                          {deletingId === lead.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertCircle size={40} />
                      <p>Nenhum lead encontrado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Message Modal */}
      <Modal
        isOpen={!!selectedLeadMessage}
        onClose={() => setSelectedLeadMessage(null)}
        title="Mensagem do Lead"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-800/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
              {selectedLeadMessage?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedLeadMessage?.name}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Mail size={14} />
                <span>{selectedLeadMessage?.email}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <MessageSquare size={14} />
              Conteúdo da Mensagem
            </h4>
            <div className="p-5 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl">
              <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedLeadMessage?.message}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" className="px-8" onClick={() => setSelectedLeadMessage(null)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Excluir Lead"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button 
              variant="danger" 
              onClick={() => confirmDelete && handleDeleteLead(confirmDelete)}
              disabled={!!deletingId}
            >
              {deletingId ? <Loader2 className="animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
