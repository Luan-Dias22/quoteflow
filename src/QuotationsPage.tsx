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
  AlertCircle
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Card, Modal, Label } from './components/UI';
import { Tool } from './types';
import { cn } from './lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BudgetItem {
  toolId: string;
  name: string;
  quantity: number;
  price: number;
}

export default function QuotationsPage() {
  const { user, profile } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchTools = async () => {
      if (!user) return;
      setLoadingTools(true);
      try {
        const q = query(
          collection(db, 'tools'),
          where('userId', '==', user.uid),
          orderBy('name', 'asc')
        );
        const snap = await getDocs(q);
        setTools(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool)));
      } catch (err) {
        console.error('Error fetching tools:', err);
      } finally {
        setLoadingTools(false);
      }
    };

    fetchTools();
  }, [user]);

  const addItem = (tool: Tool) => {
    if (budgetItems.find(item => item.toolId === tool.id)) return;
    
    setBudgetItems(prev => [
      ...prev,
      {
        toolId: tool.id!,
        name: tool.name,
        quantity: 1,
        price: tool.referencePrice || 0
      }
    ]);
    setIsToolModalOpen(false);
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
      const tableData = budgetItems.map(item => [
        item.name,
        item.quantity.toString(),
        `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Produto', 'Quantidade', 'Preço Unit.', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [14, 165, 233] },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY;
      
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      const totalText = `Valor Total do Orçamento: R$ ${calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      doc.text(totalText, 196 - doc.getTextWidth(totalText), finalY + 15);

      doc.save(`Orcamento_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Orçamentos</h1>
          <p className="text-gray-500 dark:text-slate-400">Monte orçamentos, compare preços e gere relatórios.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setBudgetItems([])}
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

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Selection and List */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PlusCircle size={20} className="text-[#0EA5E9]" />
                Itens do Orçamento
              </h3>
              <Button size="sm" onClick={() => setIsToolModalOpen(true)} className="gap-2">
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
                className="w-full mt-6 py-6 font-bold text-base"
                disabled={budgetItems.length === 0}
              >
                Gerar Relatório PDF
              </Button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 flex items-center gap-2">
              <AlertCircle size={14} />
              <span>O PDF será gerado com os dados acima.</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Tool Selection Modal */}
      <Modal
        isOpen={isToolModalOpen}
        onClose={() => setIsToolModalOpen(false)}
        title="Selecionar Produtos"
        footer={
          <Button variant="outline" onClick={() => setIsToolModalOpen(false)}>Fechar</Button>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar no seu inventário..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
            {loadingTools ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto animate-spin text-[#0EA5E9]" />
              </div>
            ) : filteredTools.length > 0 ? (
              filteredTools.map(tool => (
                <div 
                  key={tool.id} 
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group",
                    budgetItems.find(item => item.toolId === tool.id) && "opacity-50 pointer-events-none grayscale"
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
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => addItem(tool)}
                    className="h-8 w-8 p-0 text-[#0EA5E9]"
                    disabled={!!budgetItems.find(item => item.toolId === tool.id)}
                  >
                    <Plus size={18} />
                  </Button>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-gray-400 text-sm">
                Nenhum produto encontrado.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
