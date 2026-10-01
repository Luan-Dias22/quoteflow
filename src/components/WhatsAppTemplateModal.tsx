import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  FileText, 
  Sparkles, 
  Users, 
  Clock, 
  Check, 
  AlertCircle,
  Building,
  Phone
} from 'lucide-react';
import { Button, Input, Modal, Label, Textarea } from './UI';
import { Supplier, Tool } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.993.57 2.039.871 3.208.871h.005c3.181 0 5.767-2.586 5.767-5.766.001-3.182-2.585-5.758-5.767-5.758zm3.364 8.163c-.144.405-.837.774-1.17.822-.312.043-.683.07-2.091-.518-1.528-.636-2.518-2.189-2.596-2.292-.075-.104-.622-.828-.622-1.579 0-.75.394-1.12.535-1.27.14-.15.307-.188.409-.188.103 0 .205.002.295.006.096.005.225-.037.351.266.13.313.444 1.082.483 1.161.039.078.065.17.013.272-.051.103-.077.167-.154.256-.076.09-.16.201-.229.27-.077.078-.157.163-.068.316.089.153.396.653.85 1.057.585.522 1.078.683 1.231.76.153.077.243.064.333-.039.09-.102.384-.447.487-.6.102-.153.205-.128.345-.077.141.051.895.422 1.049.499.153.076.255.115.293.179.038.064.038.371-.106.776zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.661 1.435 5.176L2 22l4.957-1.399C8.423 21.493 10.153 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
  </svg>
);

export interface BudgetItem {
  toolId: string;
  name: string;
  quantity: number;
  price: number;
  description?: string;
}

interface WhatsAppTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  tools: Tool[];
  budgetItems: BudgetItem[];
  initialSupplierId?: string;
  companyName?: string;
  userId?: string;
  onSuccess?: (msg: string) => void;
}

interface TemplateOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  content: string;
}

const PREDEFINED_TEMPLATES: TemplateOption[] = [
  {
    id: 'budget_items',
    title: 'Cotação de Itens (Orçamento)',
    description: 'Envia os itens e quantidades atualmente montados no orçamento.',
    icon: '📋',
    content: `Olá, {fornecedor}! Tudo bem?
Aqui é da empresa {empresa}.
Gostaria de solicitar cotação e prazos de entrega para os seguintes itens:

{lista_itens}

Poderia nos informar valores unitários, disponibilidade em estoque e condições de pagamento?
Fico no aguardo do seu retorno. Muito obrigado!`
  },
  {
    id: 'catalog_request',
    title: 'Tabela de Preços & Catálogo',
    description: 'Solicita lista de preços e produtos atualizada para o fornecedor.',
    icon: '📦',
    content: `Olá, {fornecedor}! Tudo bem?
Aqui é da {empresa}.
Gostaria de solicitar a tabela de preços atualizada e o catálogo de produtos e ferramentas disponíveis para fornecimento.
Fico no aguardo do envio. Muito obrigado!`
  },
  {
    id: 'follow_up',
    title: 'Acompanhamento / Follow-up',
    description: 'Verifica o andamento de uma cotação enviada anteriormente.',
    icon: '⏱️',
    content: `Olá, {fornecedor}! Tudo bem?
Passando para acompanhar a solicitação de cotação enviada recentemente pela {empresa}.
Vocês conseguiram avaliar os itens e prazos? Se precisarem de mais detalhes, estou à disposição!
Obrigado!`
  },
  {
    id: 'urgency',
    title: 'Reposição Urgente',
    description: 'Mensagem com prioridade alta para pronta entrega.',
    icon: '⚡',
    content: `Olá, {fornecedor}! Tudo bem?
Estamos precisando repor os seguintes itens com urgência para a {empresa}:

{lista_itens}

Vocês teriam pronta entrega ou prazo curto para expedição?
Aguardo seu retorno o mais breve possível. Muito obrigado!`
  }
];

export default function WhatsAppTemplateModal({
  isOpen,
  onClose,
  suppliers,
  tools,
  budgetItems,
  initialSupplierId,
  companyName,
  userId,
  onSuccess
}: WhatsAppTemplateModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('budget_items');
  const [customMessage, setCustomMessage] = useState<string>(PREDEFINED_TEMPLATES[0].content);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'budget_linked'>('all');
  const [copied, setCopied] = useState(false);
  const [sentSupplierIds, setSentSupplierIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'template' | 'suppliers'>('template');

  // Supplier IDs that are linked to tools in the current budget
  const budgetLinkedSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    budgetItems.forEach(item => {
      const tool = tools.find(t => t.id === item.toolId);
      if (tool && tool.contacts) {
        suppliers.forEach(s => {
          if (tool.contacts.includes(s.whatsapp)) {
            if (s.id) ids.add(s.id);
          }
        });
      }
    });
    return ids;
  }, [budgetItems, tools, suppliers]);

  // Reset or preset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialSet = new Set<string>();
      if (initialSupplierId) {
        initialSet.add(initialSupplierId);
      } else if (budgetLinkedSupplierIds.size > 0) {
        budgetLinkedSupplierIds.forEach(id => initialSet.add(id));
      }
      setSelectedSupplierIds(initialSet);
      setSentSupplierIds(new Set());
      setActiveTab(initialSet.size > 0 ? 'template' : 'suppliers');
    }
  }, [isOpen, initialSupplierId, budgetLinkedSupplierIds]);

  const handleSelectTemplate = (template: TemplateOption) => {
    setSelectedTemplateId(template.id);
    setCustomMessage(template.content);
  };

  const formattedItemsList = useMemo(() => {
    if (budgetItems.length === 0) {
      return '(Nenhum item adicionado no orçamento atual)';
    }
    return budgetItems.map(item => {
      const desc = item.description ? ` (Ref/Cód: ${item.description})` : '';
      return `• ${item.quantity}x ${item.name}${desc}`;
    }).join('\n');
  }, [budgetItems]);

  const resolvePlaceholders = (text: string, supplier?: Supplier) => {
    const sName = supplier ? (supplier.company ? `${supplier.name} (${supplier.company})` : supplier.name) : '{fornecedor}';
    const cName = companyName || 'nossa empresa';
    const today = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

    return text
      .replace(/{fornecedor}/g, sName)
      .replace(/{empresa}/g, cName)
      .replace(/{lista_itens}/g, formattedItemsList)
      .replace(/{data}/g, today);
  };

  const previewSupplier = useMemo(() => {
    const firstSelectedId = Array.from(selectedSupplierIds)[0];
    if (firstSelectedId) {
      return suppliers.find(s => s.id === firstSelectedId);
    }
    return suppliers[0];
  }, [selectedSupplierIds, suppliers]);

  const resolvedPreviewMessage = useMemo(() => {
    return resolvePlaceholders(customMessage, previewSupplier);
  }, [customMessage, previewSupplier, companyName, formattedItemsList]);

  const handleToggleSupplier = (id: string) => {
    setSelectedSupplierIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedSupplierIds);
    filteredSuppliers.forEach(s => {
      if (s.id) next.add(s.id);
    });
    setSelectedSupplierIds(next);
  };

  const handleClearSelection = () => {
    setSelectedSupplierIds(new Set());
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.whatsapp.includes(searchTerm);

      if (filterType === 'budget_linked') {
        return matchSearch && s.id && budgetLinkedSupplierIds.has(s.id);
      }
      return matchSearch;
    });
  }, [suppliers, searchTerm, filterType, budgetLinkedSupplierIds]);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(resolvedPreviewMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToSupplier = async (supplier: Supplier) => {
    if (!supplier.whatsapp) return;

    const cleanPhone = supplier.whatsapp.replace(/\D/g, '');
    const personalizedMessage = resolvePlaceholders(customMessage, supplier);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(personalizedMessage)}`;

    // Open WhatsApp
    window.open(url, '_blank');

    // Mark as sent in local state
    if (supplier.id) {
      setSentSupplierIds(prev => new Set(prev).add(supplier.id!));
    }

    // Record in quotations if userId exists
    if (userId) {
      try {
        await addDoc(collection(db, 'quotations'), {
          userId,
          toolName: budgetItems.length === 1 ? budgetItems[0].name : (budgetItems.length > 1 ? 'Cotação Conjunta' : 'Contato com Fornecedor'),
          items: budgetItems.length > 0 ? budgetItems.map(b => ({
            toolId: b.toolId,
            toolName: b.name,
            quantity: b.quantity,
            description: b.description
          })) : [],
          contacts: [supplier.whatsapp],
          message: personalizedMessage,
          status: 'Enviado',
          pdfUrl: null,
          pdfName: null,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error logging sent quotation to firestore:', err);
      }
    }

    if (onSuccess) {
      onSuccess(`WhatsApp aberto para ${supplier.name}!`);
    }
  };

  const insertVariable = (variable: string) => {
    setCustomMessage(prev => prev + ` ${variable} `);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disparar Mensagem WhatsApp"
      size="xl"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
            <span>
              {selectedSupplierIds.size === 0
                ? 'Nenhum fornecedor selecionado'
                : `${selectedSupplierIds.size} fornecedor(es) selecionado(s)`}
            </span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-initial">
              Fechar
            </Button>
            {selectedSupplierIds.size > 0 && (
              <Button
                onClick={() => {
                  const firstSupplierId = Array.from(selectedSupplierIds)[0];
                  const supplier = suppliers.find(s => s.id === firstSupplierId);
                  if (supplier) handleSendToSupplier(supplier);
                }}
                className="bg-[#25D366] hover:bg-[#20ba5a] text-white border-none gap-2 flex-1 sm:flex-initial shadow-md"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Abrir WhatsApp ({selectedSupplierIds.size})
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('template')}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'template'
                ? 'border-[#25D366] text-[#25D366] dark:text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Sparkles size={16} />
            1. Modelo da Mensagem
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all relative ${
              activeTab === 'suppliers'
                ? 'border-[#25D366] text-[#25D366] dark:text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Users size={16} />
            2. Selecionar Fornecedores
            {selectedSupplierIds.size > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-[#25D366] text-white font-bold">
                {selectedSupplierIds.size}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Template Selection & Preview */}
        {activeTab === 'template' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Quick Templates Selection */}
            <div>
              <Label className="mb-2 block font-semibold text-gray-900 dark:text-white">
                Selecione um Modelo Predefinido:
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PREDEFINED_TEMPLATES.map(tmpl => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#25D366] bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-[#25D366]'
                          : 'border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{tmpl.icon}</span>
                        <p className="font-bold text-sm text-gray-900 dark:text-white">{tmpl.title}</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{tmpl.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Template Variables Helper */}
            <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800 text-xs space-y-2">
              <span className="font-semibold text-gray-700 dark:text-slate-300">Variáveis automáticas disponíveis:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{fornecedor}', label: 'Nome Fornecedor' },
                  { tag: '{empresa}', label: 'Sua Empresa' },
                  { tag: '{lista_itens}', label: 'Lista de Itens c/ Qtd e Código' },
                  { tag: '{data}', label: 'Data Atual' }
                ].map(item => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertVariable(item.tag)}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-mono text-[11px] text-gray-700 dark:text-slate-200 hover:border-[#25D366] hover:text-[#25D366] transition-colors"
                  >
                    + {item.tag} ({item.label})
                  </button>
                ))}
              </div>
            </div>

            {/* Message Editor */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label htmlFor="customMessage" className="font-semibold">
                  Texto da Mensagem (Editável):
                </Label>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar texto resolvido'}
                </button>
              </div>
              <Textarea
                id="customMessage"
                rows={6}
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                placeholder="Escreva a mensagem para o fornecedor..."
                className="font-sans text-sm leading-relaxed"
              />
            </div>

            {/* Live Preview Box */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-[#f0fdf4] dark:bg-emerald-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                  Pré-visualização da mensagem para {previewSupplier?.name || 'Fornecedor'}:
                </span>
                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-500">
                  {previewSupplier?.whatsapp || 'Sem telefone'}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-emerald-100 dark:border-emerald-900/30 text-xs text-gray-800 dark:text-slate-200 whitespace-pre-line font-sans leading-relaxed">
                {resolvedPreviewMessage}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setActiveTab('suppliers')}
                className="gap-2 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white border-none"
              >
                Prosseguir para Fornecedores ({selectedSupplierIds.size})
                <Users size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Supplier Selection */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Buscar por fornecedor, empresa ou WhatsApp..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filterType === 'all' ? 'primary' : 'outline'}
                  onClick={() => setFilterType('all')}
                  className={filterType === 'all' ? 'bg-gray-900 dark:bg-slate-700 text-white' : ''}
                >
                  Todos ({suppliers.length})
                </Button>
                {budgetLinkedSupplierIds.size > 0 && (
                  <Button
                    size="sm"
                    variant={filterType === 'budget_linked' ? 'primary' : 'outline'}
                    onClick={() => setFilterType('budget_linked')}
                    className={filterType === 'budget_linked' ? 'bg-[#0EA5E9] text-white border-none' : ''}
                  >
                    Vinculados aos Itens ({budgetLinkedSupplierIds.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Selection Quick Actions */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 px-1">
              <span>{selectedSupplierIds.size} de {suppliers.length} selecionados</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-[#0EA5E9] hover:underline font-medium"
                >
                  Selecionar visíveis
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-red-500 hover:underline font-medium"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>

            {/* Suppliers List */}
            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredSuppliers.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  Nenhum fornecedor encontrado para os filtros selecionados.
                </div>
              ) : (
                filteredSuppliers.map(supplier => {
                  const isSelected = selectedSupplierIds.has(supplier.id!);
                  const isSent = supplier.id ? sentSupplierIds.has(supplier.id) : false;
                  const isLinkedToBudget = supplier.id ? budgetLinkedSupplierIds.has(supplier.id) : false;

                  return (
                    <div
                      key={supplier.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-[#25D366] bg-emerald-50/40 dark:bg-emerald-950/15'
                          : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => handleToggleSupplier(supplier.id!)}
                      >
                        <div
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-[#25D366] border-[#25D366] text-white'
                              : 'border-gray-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-gray-900 dark:text-white">
                              {supplier.name}
                            </p>
                            {isLinkedToBudget && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded">
                                Item no orçamento
                              </span>
                            )}
                            {isSent && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Check size={10} /> Enviado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Building size={12} /> {supplier.company}
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <Phone size={12} /> {supplier.whatsapp}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Direct Send Button for this specific supplier */}
                      <button
                        type="button"
                        onClick={() => handleSendToSupplier(supplier)}
                        title={`Abrir WhatsApp para ${supplier.name}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-xs transition-transform active:scale-95 shrink-0 ml-2"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        <span>Abrir</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('template')}
              >
                Voltar ao Modelo
              </Button>

              {selectedSupplierIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {selectedSupplierIds.size} selecionado(s)
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      // Open each selected supplier's WhatsApp
                      const selectedList = suppliers.filter(s => s.id && selectedSupplierIds.has(s.id));
                      if (selectedList.length > 0) {
                        // Open first one and prompt
                        handleSendToSupplier(selectedList[0]);
                      }
                    }}
                    className="bg-[#25D366] hover:bg-[#20ba5a] text-white border-none gap-1.5"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    Enviar pelo WhatsApp
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
