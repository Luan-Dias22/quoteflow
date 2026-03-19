import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Wrench, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  Phone,
  ArrowRight,
  Info,
  Filter,
  ChevronDown
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Label, Card, Textarea } from './components/UI';
import { Tool, Supplier } from './types';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function AutomationPage() {
  const { user, profile } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTools, setSelectedTools] = useState<{ [id: string]: number }>({});
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupTools, setGroupTools] = useState(true);
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [toolCategoryFilter, setToolCategoryFilter] = useState('all');
  const [messageTemplate, setMessageTemplate] = useState(
    "Olá! Sou da {empresa}. Gostaria de solicitar uma cotação para os seguintes itens:\n{lista_itens}\nFico no aguardo do seu retorno. Obrigado!"
  );
  const [isSending, setIsSending] = useState(false);
  const [step, setStep] = useState(1);
  const [isQuickQuote, setIsQuickQuote] = useState(false);
  const [selectedQuickSupplierId, setSelectedQuickSupplierId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTools({});
  }, [isQuickQuote, selectedQuickSupplierId]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const toolsSnap = await getDocs(query(collection(db, 'tools'), where('userId', '==', user.uid)));
        const suppliersSnap = await getDocs(query(collection(db, 'suppliers'), where('userId', '==', user.uid)));
        
        setTools(toolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool)));
        setSuppliers(suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'tools/suppliers');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleToggleTool = (id: string) => {
    setSelectedTools(prev => {
      const newSelected = { ...prev };
      if (newSelected[id]) {
        delete newSelected[id];
      } else {
        newSelected[id] = 1;
      }
      return newSelected;
    });
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    setSelectedTools(prev => ({
      ...prev,
      [id]: Math.max(1, qty)
    }));
  };

  const handleToggleContact = (phone: string) => {
    setSelectedContacts(prev => 
      prev.includes(phone) ? prev.filter(c => c !== phone) : [...prev, phone]
    );
  };

  const getToolContacts = () => {
    const contacts = new Set<string>();
    Object.keys(selectedTools).forEach(toolId => {
      const tool = tools.find(t => t.id === toolId);
      tool?.contacts.forEach(c => contacts.add(c));
    });
    return Array.from(contacts);
  };

  const generateMessage = (toolOrTools: Tool | { tool: Tool, quantity: number }[], quantity?: number) => {
    let message = messageTemplate.replace('{empresa}', profile?.companyName || 'nossa empresa');

    if (Array.isArray(toolOrTools)) {
      const list = toolOrTools
        .map(item => `- ${item.quantity}x ${item.tool.name} (${item.tool.description})`)
        .join('\n');
      return message.replace('{lista_itens}', list);
    } else {
      return message
        .replace('{nome_item}', toolOrTools.name)
        .replace('{descrição}', toolOrTools.description)
        .replace('{quantidade}', (quantity || 1).toString())
        .replace('{lista_itens}', `${quantity}x ${toolOrTools.name}`);
    }
  };

  const goToStep2 = () => {
    if (isQuickQuote) {
      const supplier = suppliers.find(s => s.id === selectedQuickSupplierId);
      if (supplier) {
        setSelectedContacts([supplier.whatsapp]);
      }
    } else {
      const allContacts = getToolContacts();
      setSelectedContacts(allContacts);
    }
    setStep(2);
  };

  const handleSend = async () => {
    if (!user) return;
    setIsSending(true);
    setError(null);

    try {
      const batchTimestamp = new Date().toISOString();

      if (groupTools) {
        // Group by contact
        const contactMap = new Map<string, { tool: Tool, quantity: number }[]>();
        
        if (isQuickQuote && selectedContacts.length > 0) {
          const contact = selectedContacts[0];
          const toolList = Object.entries(selectedTools)
            .map(([toolId, quantity]) => {
              const tool = tools.find(t => t.id === toolId);
              return tool ? { tool, quantity } : null;
            })
            .filter((item): item is { tool: Tool, quantity: number } => item !== null);
          contactMap.set(contact, toolList);
        } else {
          Object.entries(selectedTools).forEach(([toolId, quantity]) => {
            const tool = tools.find(t => t.id === toolId);
            if (tool) {
              tool.contacts.forEach(contact => {
                // Only include if contact is selected
                if (selectedContacts.includes(contact)) {
                  const current = contactMap.get(contact) || [];
                  contactMap.set(contact, [...current, { tool, quantity }]);
                }
              });
            }
          });
        }

        for (const [contact, toolList] of contactMap.entries()) {
          const message = generateMessage(toolList);
          
          // Save to history (one entry for the whole group)
          try {
            await addDoc(collection(db, 'quotations'), {
              userId: user.uid,
              items: toolList.map(item => ({
                toolId: item.tool.id,
                toolName: item.tool.name,
                quantity: item.quantity
              })),
              toolName: toolList.length === 1 ? toolList[0].tool.name : 'Cotação Conjunta',
              contacts: [contact],
              message,
              status: 'Enviado',
              fileURL: null,
              fileName: null,
              createdAt: batchTimestamp
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'quotations');
          }

          // Open WhatsApp
          const cleanPhone = contact.replace(/\D/g, '');
          const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank');
        }
      } else {
        // Individual messages
        if (isQuickQuote && selectedContacts.length > 0) {
          const contact = selectedContacts[0];
          for (const [toolId, quantity] of Object.entries(selectedTools)) {
            const tool = tools.find(t => t.id === toolId);
            if (!tool) continue;

            const message = generateMessage(tool, quantity);
            
            try {
              await addDoc(collection(db, 'quotations'), {
                userId: user.uid,
                toolId,
                toolName: tool.name,
                quantity,
                contacts: [contact],
                message,
                status: 'Enviado',
                fileURL: null,
                fileName: null,
                createdAt: batchTimestamp
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'quotations');
            }

            const cleanPhone = contact.replace(/\D/g, '');
            const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
          }
        } else {
          for (const [toolId, quantity] of Object.entries(selectedTools)) {
            const tool = tools.find(t => t.id === toolId);
            if (!tool) continue;

            const message = generateMessage(tool, quantity);
            const contactsToSend = tool.contacts.filter(c => selectedContacts.includes(c));

            for (const contact of contactsToSend) {
              try {
                await addDoc(collection(db, 'quotations'), {
                  userId: user.uid,
                  toolId,
                  toolName: tool.name,
                  quantity,
                  contacts: [contact],
                  message,
                  status: 'Enviado',
                  fileURL: null,
                  fileName: null,
                  createdAt: batchTimestamp
                });
              } catch (error) {
                handleFirestoreError(error, OperationType.CREATE, 'quotations');
              }

              const cleanPhone = contact.replace(/\D/g, '');
              const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
              window.open(url, '_blank');
            }
          }
        }
      }
      
      setStep(3);
    } catch (error) {
      console.error('Error sending quotations:', error);
    } finally {
      setIsSending(false);
    }
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(toolSearchTerm.toLowerCase()) || 
                         tool.category.toLowerCase().includes(toolSearchTerm.toLowerCase());
    const matchesCategory = toolCategoryFilter === 'all' || tool.category === toolCategoryFilter;
    
    let matchesSupplier = true;
    if (isQuickQuote && selectedQuickSupplierId) {
      const supplier = suppliers.find(s => s.id === selectedQuickSupplierId);
      if (supplier) {
        matchesSupplier = tool.contacts.includes(supplier.whatsapp);
      }
    }

    return matchesSearch && matchesCategory && matchesSupplier;
  });

  const categories = Array.from(new Set(tools.map(t => t.category))).sort();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#0EA5E9]" />
          <p className="text-sm text-gray-500 dark:text-slate-400 animate-pulse">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full font-bold transition-all',
              step >= s ? 'bg-[#0EA5E9] text-white shadow-lg shadow-blue-100 dark:shadow-none' : 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-500'
            )}>
              {step > s ? <CheckCircle2 size={20} /> : s}
            </div>
            {s < 3 && <div className={cn('h-1 w-12 rounded-full', step > s ? 'bg-[#0EA5E9]' : 'bg-gray-200 dark:bg-slate-800')} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Selecione os Itens</h2>
            <p className="text-gray-500 dark:text-slate-400">Escolha quais itens você deseja cotar agora.</p>
          </div>

          <Card className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isQuickQuote ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                )}>
                  <Send size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cotação Rápida</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Enviar para um fornecedor específico</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isQuickQuote}
                    onChange={(e) => {
                      setIsQuickQuote(e.target.checked);
                      if (!e.target.checked) setSelectedQuickSupplierId('');
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0EA5E9]"></div>
                </label>
              </div>
            </div>

            {isQuickQuote && (
              <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/20 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label className="mb-2 block">Selecione o Fornecedor</Label>
                <select 
                  className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none transition-colors"
                  value={selectedQuickSupplierId}
                  onChange={(e) => setSelectedQuickSupplierId(e.target.value)}
                >
                  <option value="" className="dark:bg-slate-800">Selecione um fornecedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id} className="dark:bg-slate-800">{s.name} ({s.company})</option>
                  ))}
                </select>
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
              <Input 
                placeholder="Buscar por nome ou categoria..." 
                className="pl-10"
                value={toolSearchTerm}
                onChange={(e) => setToolSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative w-full sm:w-64">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
              <select 
                className="flex h-10 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none appearance-none transition-colors"
                value={toolCategoryFilter}
                onChange={(e) => setToolCategoryFilter(e.target.value)}
              >
                <option value="all" className="dark:bg-slate-800">Todas Categorias</option>
                {categories.map(cat => (
                  <option key={cat} value={cat} className="dark:bg-slate-800">{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => {
              const isSelected = !!selectedTools[tool.id!];
              return (
                <Card 
                  key={tool.id} 
                  className={cn(
                    'p-4 transition-all border-2 flex flex-col gap-4',
                    isSelected ? 'border-[#0EA5E9] bg-blue-50/30 dark:bg-blue-900/10' : 'border-transparent hover:border-gray-200 dark:hover:border-slate-700'
                  )}
                >
                  <div 
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => handleToggleTool(tool.id!)}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 overflow-hidden">
                      {tool.photoURL ? (
                        <img src={tool.photoURL} alt={tool.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Wrench size={20} />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">{tool.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{tool.category}</p>
                    </div>
                    <div className={cn(
                      'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected ? 'bg-[#0EA5E9] border-[#0EA5E9]' : 'border-gray-200 dark:border-slate-700'
                    )}>
                      {isSelected && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-3 pt-3 border-t border-blue-100 dark:border-blue-900/30 animate-in fade-in slide-in-from-top-1">
                      <Label htmlFor={`qty-${tool.id}`} className="text-xs font-bold text-[#0EA5E9]">Qtd:</Label>
                      <Input 
                        id={`qty-${tool.id}`}
                        type="number"
                        min="1"
                        className="h-8 w-20 text-center text-sm bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900/50 focus:ring-[#0EA5E9]"
                        value={selectedTools[tool.id!]}
                        onChange={(e) => handleUpdateQuantity(tool.id!, parseInt(e.target.value) || 1)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
            {filteredTools.length === 0 && (
              <div className="col-span-full py-20 text-center bg-gray-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-slate-800">
                <AlertCircle size={48} className="mx-auto mb-4 text-gray-300 dark:text-slate-700" />
                <p className="text-lg font-medium text-gray-900 dark:text-white">Nenhuma ferramenta encontrada</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">Tente ajustar seus filtros de busca.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-8">
            <Button 
              size="lg" 
              disabled={Object.keys(selectedTools).length === 0 || (isQuickQuote && !selectedQuickSupplierId)}
              onClick={goToStep2}
              className="gap-2"
            >
              Próximo Passo
              <ArrowRight size={20} />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configure o Envio</h2>
            <p className="text-gray-500 dark:text-slate-400">Revise a mensagem e os contatos antes de enviar.</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-[#0EA5E9]">
                    <MessageSquare size={20} />
                    <h3 className="font-bold">Template da Mensagem</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={groupTools}
                        onChange={(e) => setGroupTools(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0EA5E9]"></div>
                      <span className="ml-3 text-xs font-bold text-gray-600 dark:text-slate-400">Agrupar itens</span>
                    </label>
                  </div>
                </div>
                <Textarea 
                  className="min-h-[150px] p-4"
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {['{empresa}', '{nome_item}', '{descrição}', '{quantidade}', '{lista_itens}'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-[10px] font-mono text-gray-600 dark:text-slate-400">{tag}</span>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex gap-3">
                  <Info size={18} className="text-[#0EA5E9] shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    As variáveis serão substituídas automaticamente para cada ferramenta selecionada.
                  </p>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4 text-[#10B981]">
                  <Phone size={20} />
                  <h3 className="font-bold">Contatos Selecionados</h3>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(isQuickQuote ? selectedContacts : getToolContacts()).map((contact) => {
                    const supplier = suppliers.find(s => s.whatsapp === contact);
                    const isSelected = selectedContacts.includes(contact);
                    
                    return (
                      <div 
                        key={contact}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                          isSelected 
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30" 
                            : "bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 opacity-60",
                          isQuickQuote && "cursor-default"
                        )}
                        onClick={() => !isQuickQuote && handleToggleContact(contact)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-5 w-5 rounded border flex items-center justify-center transition-colors",
                            isSelected ? "bg-[#10B981] border-[#10B981]" : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700"
                          )}>
                            {isSelected && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{supplier?.name || 'Fornecedor'}</span>
                            <span className="text-[10px] text-gray-500 dark:text-slate-400">{contact}</span>
                          </div>
                        </div>
                        {isSelected && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Selecionado</span>}
                      </div>
                    );
                  })}
                  {getToolContacts().length === 0 && (
                    <div className="text-center py-10">
                      <AlertCircle size={32} className="mx-auto mb-2 text-gray-300 dark:text-slate-700" />
                      <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum contato vinculado a estes itens.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between pt-8 items-center">
              <Button variant="outline" size="lg" onClick={() => setStep(1)} disabled={isSending}>Voltar</Button>
              
              <Button 
                size="lg" 
                variant="secondary"
                className="gap-2 h-14 px-10 text-lg shadow-xl shadow-emerald-100 dark:shadow-none min-w-[280px]"
                disabled={isSending || getToolContacts().length === 0}
                onClick={handleSend}
              >
                {isSending ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin" />
                    <span className="text-sm">
                      Processando...
                    </span>
                  </div>
                ) : (
                  <>
                    <Send size={20} />
                    ENVIAR VIA WHATSAPP
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-20 animate-in zoom-in duration-500">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Cotações Iniciadas!</h2>
          <p className="text-gray-600 dark:text-slate-400 max-w-md mx-auto mb-10">
            As abas do WhatsApp foram abertas. O histórico de envios foi atualizado automaticamente.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => { setStep(1); setSelectedTools({}); setSelectedContacts([]); }}>Nova Automação</Button>
            <Button variant="outline" onClick={() => window.location.href = '/history'}>Ver Histórico</Button>
          </div>
        </div>
      )}
    </div>
  );
}
