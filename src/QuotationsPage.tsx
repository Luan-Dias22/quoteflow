import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  Download, 
  PlusCircle, 
  Wrench,
  DollarSign,
  Package,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Card, Modal, Label } from './components/UI';
import { Tool, Supplier, Quotation } from './types';
import { cn } from './lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

interface BudgetItem {
  toolId: string;
  name: string;
  quantity: number;
  price: number;
  description?: string;
}

export default function QuotationsPage() {
  const { user, profile } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Quotation[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Load from localStorage on mount/user change
  useEffect(() => {
    if (user && !isLoaded) {
      const saved = localStorage.getItem(`budget_items_${user.uid}`);
      if (saved) {
        setBudgetItems(JSON.parse(saved));
      }
      const savedSupplier = localStorage.getItem(`budget_supplier_${user.uid}`);
      if (savedSupplier) {
        setSelectedSupplierId(savedSupplier);
      }
      setIsLoaded(true);
    }
  }, [user, isLoaded]);

  // Save to localStorage whenever budgetItems changes
  useEffect(() => {
    if (user && isLoaded) {
      localStorage.setItem(`budget_items_${user.uid}`, JSON.stringify(budgetItems));
      localStorage.setItem(`budget_supplier_${user.uid}`, selectedSupplierId);
    }
  }, [budgetItems, selectedSupplierId, user, isLoaded]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoadingTools(true);
      try {
        const qTools = query(
          collection(db, 'tools'),
          where('userId', '==', user.uid),
          orderBy('name', 'asc')
        );
        const qSuppliers = query(
          collection(db, 'suppliers'),
          where('userId', '==', user.uid),
          orderBy('name', 'asc')
        );
        const qDrafts = query(
          collection(db, 'quotations'),
          where('userId', '==', user.uid),
          where('status', '==', 'Rascunho')
        );
        const [snapTools, snapSuppliers, snapDrafts] = await Promise.all([getDocs(qTools), getDocs(qSuppliers), getDocs(qDrafts)]);
        setTools(snapTools.docs.map(d => ({ id: d.id, ...d.data() } as Tool)));
        setSuppliers(snapSuppliers.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
        
        // Sort drafts by createdAt descending locally since we don't have a composite index right now for userId + status + createdAt
        const loadedDrafts = snapDrafts.docs.map(d => ({ id: d.id, ...d.data() } as Quotation));
        loadedDrafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setDrafts(loadedDrafts);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoadingTools(false);
      }
    };

    fetchData();
  }, [user]);

  const addSelectedItems = () => {
    const newItems = Array.from(selectedTools)
      .map(id => tools.find(t => t.id === id))
      .filter(Boolean) as Tool[];
    
    const itemsToAdd = newItems.filter(tool => !budgetItems.find(item => item.toolId === tool.id));
    
    if (itemsToAdd.length > 0) {
      setBudgetItems(prev => [
        ...prev,
        ...itemsToAdd.map(tool => ({
          toolId: tool.id!,
          name: tool.name,
          quantity: 1,
          price: tool.referencePrice || 0,
          description: tool.description
        }))
      ]);
    }
    
    setSelectedTools(new Set());
    setIsToolModalOpen(false);
  };

  const toggleToolSelection = (toolId: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const removeItem = (toolId: string) => {
    setBudgetItems(prev => prev.filter(item => item.toolId !== toolId));
  };

  const updateItem = (toolId: string, field: keyof BudgetItem, value: number) => {
    setBudgetItems(prev => prev.map(item => 
      item.toolId === toolId ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = () => {
    return budgetItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  };

  const generatePDF = () => {
    if (budgetItems.length === 0) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const date = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(14, 165, 233); // #0EA5E9
      doc.text('Relatório de Orçamento', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Empresa: ${profile?.companyName || 'N/A'}`, 14, 32);
      doc.text(`Data: ${date}`, 14, 38);
      
      // Table
      const allPricesZero = budgetItems.every(item => item.price === 0);
      
      const head = allPricesZero 
        ? [['Produto', 'Quantidade']] 
        : [['Produto', 'Quantidade', 'Preço Unit.', 'Total']];

      const tableData = budgetItems.map(item => {
        if (allPricesZero) {
          return [item.name, item.quantity.toString()];
        }
        return [
          item.name,
          item.quantity.toString(),
          `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        startY: 45,
        head: head,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [14, 165, 233] },
        styles: { fontSize: 9 },
        columnStyles: allPricesZero ? { 1: { halign: 'center' } } : {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY;
      
      if (!allPricesZero) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        const totalText = `Valor Total do Orçamento: R$ ${calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        doc.text(totalText, 196 - doc.getTextWidth(totalText), finalY + 15);
      }

      doc.save(`Orcamento_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveQuotation = async () => {
    if (budgetItems.length === 0 || !selectedSupplierId || !user) return;
    setIsSaving(true);
    setSuccessMsg(null);
    try {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      if (!supplier) throw new Error("Fornecedor não encontrado");
      
      const quotationData = {
        userId: user.uid,
        items: budgetItems.map(item => ({
          toolId: item.toolId,
          toolName: item.name,
          quantity: item.quantity,
          description: item.description
        })),
        toolName: budgetItems.length === 1 ? budgetItems[0].name : 'Cotação Conjunta',
        contacts: [supplier.whatsapp],
        message: "Cotação agendada para envio",
        status: 'Rascunho' as const,
        pdfUrl: null,
        pdfName: null,
      };

      if (editingDraftId) {
        await updateDoc(doc(db, 'quotations', editingDraftId), { ...quotationData, updatedAt: new Date().toISOString() });
        setSuccessMsg("Carrinho atualizado com sucesso!");
        setDrafts(prev => prev.map(d => d.id === editingDraftId ? { ...d, ...quotationData, updatedAt: new Date().toISOString() } as Quotation : d));
      } else {
        const docRef = await addDoc(collection(db, 'quotations'), { ...quotationData, createdAt: new Date().toISOString() });
        setSuccessMsg("Carrinho salvo com sucesso!");
        setDrafts(prev => [{ ...quotationData, id: docRef.id, createdAt: new Date().toISOString() } as Quotation, ...prev]);
      }

      setTimeout(() => setSuccessMsg(null), 3000);
      setBudgetItems([]);
      setSelectedSupplierId('');
      setEditingDraftId(null);
    } catch (err) {
      handleFirestoreError(err, editingDraftId ? OperationType.UPDATE : OperationType.CREATE, 'quotations');
    } finally {
      setIsSaving(false);
    }
  };

  const loadDraft = (draft: Quotation) => {
    setEditingDraftId(draft.id!);
    const supplier = suppliers.find(s => draft.contacts && draft.contacts.includes(s.whatsapp));
    if (supplier) setSelectedSupplierId(supplier.id!);
    
    if (draft.items) {
      const mappedItems = draft.items.map(di => {
        const tool = tools.find(t => t.id === di.toolId);
        return {
          toolId: di.toolId,
          name: di.toolName,
          quantity: di.quantity,
          price: tool ? (tool.referencePrice || 0) : 0,
          description: di.description || (tool ? tool.description : '')
        };
      });
      setBudgetItems(mappedItems);
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      await deleteDoc(doc(db, 'quotations', draftId));
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      if (editingDraftId === draftId) {
         setEditingDraftId(null);
         setBudgetItems([]);
         setSelectedSupplierId('');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'quotations');
    }
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const filteredTools = tools.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!selectedSupplier) return matchesSearch;
    return matchesSearch && t.contacts && t.contacts.includes(selectedSupplier.whatsapp);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Orçamentos</h1>
          <p className="text-gray-500 dark:text-slate-400">Monte orçamentos, agende cotações ou gere relatórios.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => { setBudgetItems([]); setSelectedSupplierId(''); setEditingDraftId(null); }}
            disabled={budgetItems.length === 0}
            className="gap-2"
          >
            Limpar
          </Button>
          <Button 
            onClick={generatePDF} 
            disabled={budgetItems.length === 0 || isGenerating}
            className="gap-2 bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:from-blue-600 hover:to-emerald-600 border-none shadow-md shadow-blue-200 dark:shadow-none"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Gerar PDF
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/30 font-medium text-sm">
          {successMsg}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Selection and List */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PlusCircle size={20} className="text-[#0EA5E9]" />
                Itens do Orçamento
              </h3>
              <Button size="sm" onClick={() => { setSelectedTools(new Set()); setIsToolModalOpen(true); }} className="gap-2">
                <Plus size={16} />
                Adicionar Produto
              </Button>
            </div>

            {budgetItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3 text-center w-24">Qtd</th>
                      <th className="px-4 py-3 text-right">Preço Unit.</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                    {budgetItems.map((item) => (
                      <tr key={item.toolId} className="group">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Input 
                            type="number"
                            min="1"
                            className="h-9 px-2 text-center"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.toolId, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="relative inline-block w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                            <Input 
                              type="number"
                              step="0.01"
                              className="h-9 pl-8 pr-2 text-right"
                              value={item.price}
                              onChange={(e) => updateItem(item.toolId, 'price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="font-bold text-gray-900 dark:text-white">
                            R$ {(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button 
                            onClick={() => removeItem(item.toolId)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center text-gray-300 dark:text-slate-700">
                  <Package size={32} />
                </div>
                <div>
                  <p className="text-gray-500 dark:text-slate-400 font-medium">Nenhum item adicionado</p>
                  <p className="text-sm text-gray-400">Comece selecionando produtos do seu inventário.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsToolModalOpen(true)}>
                  Escolher Produtos
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Summary */}
        <div className="space-y-6">
          <Card className="p-6 overflow-hidden">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Resumo</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400 border-b border-dashed border-gray-100 dark:border-slate-800 pb-2">
                <span>Total de Itens</span>
                <span className="font-semibold text-gray-900 dark:text-white">{budgetItems.length}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400 border-b border-dashed border-gray-100 dark:border-slate-800 pb-2">
                <span>Quantidade Total</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {budgetItems.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              </div>
              <div className="pt-4 mt-6 border-t border-gray-100 dark:border-slate-800 text-center">
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Valor Final</p>
                <div className="text-3xl font-black text-[#0EA5E9]">
                  R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              
              <Button 
                onClick={generatePDF} 
                className="w-full mt-6 py-6 font-bold text-base bg-emerald-500 hover:bg-emerald-600 border-none text-white"
                disabled={budgetItems.length === 0 || isGenerating}
              >
                Gerar Relatório PDF
              </Button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{editingDraftId ? 'Editando Carrinho' : 'Agendar Cotação com Fornecedor'}</Label>
                </div>
                <select 
                  className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none transition-colors disabled:opacity-50"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  disabled={!!editingDraftId}
                >
                  <option value="" className="dark:bg-slate-800">Selecione um fornecedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id} className="dark:bg-slate-800">{s.name} ({s.company})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 pb-2">
                  Selecione o fornecedor para visualizar apenas os produtos vinculados a ele, e salve este carrinho para enviá-lo depois.
                </p>
              </div>

              <div className="flex gap-2">
                {editingDraftId && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setEditingDraftId(null);
                      setBudgetItems([]);
                      setSelectedSupplierId('');
                    }} 
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                )}
                <Button 
                  onClick={saveQuotation} 
                  className={cn("font-bold text-base bg-blue-500 hover:bg-blue-600 border-none text-white", editingDraftId ? "flex-1" : "w-full")}
                  disabled={budgetItems.length === 0 || !selectedSupplierId || isSaving}
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : (editingDraftId ? 'Atualizar' : 'Salvar Carrinho')}
                </Button>
              </div>
            </div>
          </Card>

          {/* Drafts (Saved Carts) List */}
          {drafts.length > 0 && (
            <div className="space-y-4 pt-2">
              <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package size={18} className="text-blue-500" />
                Carrinhos Salvos ({drafts.length})
              </h4>
              <div className="space-y-3">
                {drafts.map(draft => {
                  const draftSupplier = suppliers.find(s => draft.contacts && draft.contacts.includes(s.whatsapp));
                  const isActive = editingDraftId === draft.id;
                  
                  return (
                    <Card key={draft.id} className={cn("p-4 flex flex-col gap-3 transition-colors", isActive && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10")}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">
                            {draftSupplier ? draftSupplier.name : 'Desconhecido'}
                          </p>
                          <p className="text-xs text-gray-500">{draft.items?.length || 0} itens no carrinho</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => loadDraft(draft)} 
                            className={cn("h-8 px-2", isActive ? "text-blue-600" : "text-blue-500")}
                            disabled={isActive}
                          >
                            {isActive ? 'Editando' : 'Editar'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteDraft(draft.id!)} 
                            className="h-8 px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tool Selection Modal */}
      <Modal
        isOpen={isToolModalOpen}
        onClose={() => setIsToolModalOpen(false)}
        title="Selecionar Produtos"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => setIsToolModalOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 bg-[#0EA5E9] text-white hover:bg-[#0EA5E9]/90 border-none disabled:opacity-50"
              onClick={addSelectedItems}
              disabled={selectedTools.size === 0}
            >
              Adicionar ({selectedTools.size})
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder={selectedSupplier ? `Buscar produtos de ${selectedSupplier.name}...` : "Buscar no seu inventário..."}
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {selectedSupplier && (
            <div className="text-xs text-[#0EA5E9] bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800/30 flex items-center gap-2">
              <AlertCircle size={14} />
              Mostrando apenas produtos vinculados ao fornecedor {selectedSupplier.name}.
            </div>
          )}

          <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
            {loadingTools ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto animate-spin text-[#0EA5E9]" />
              </div>
            ) : filteredTools.length > 0 ? (
              filteredTools.map(tool => {
                const isAlreadyAdded = !!budgetItems.find(item => item.toolId === tool.id);
                const isSelected = selectedTools.has(tool.id!);
                
                return (
                  <div 
                    key={tool.id} 
                    onClick={() => {
                      if (!isAlreadyAdded) toggleToolSelection(tool.id!);
                    }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group",
                      isAlreadyAdded && "opacity-50 pointer-events-none grayscale",
                      isSelected && "border-[#0EA5E9] bg-blue-50/50 dark:bg-blue-900/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                        {tool.photoURL ? (
                          <img src={tool.photoURL} alt={tool.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                        ) : (
                          <Wrench size={18} />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{tool.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-500">{tool.category}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected 
                        ? "bg-[#0EA5E9] border-[#0EA5E9] text-white" 
                        : "border-gray-200 dark:border-slate-700 text-transparent"
                    )}>
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-gray-400 text-sm">
                {selectedSupplier ? 'Nenhum produto vinculado a este fornecedor foi encontrado.' : 'Nenhum produto encontrado.'}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
