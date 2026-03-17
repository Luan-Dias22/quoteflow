import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Wrench, 
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Tag,
  DollarSign,
  Phone,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  limit, 
  startAfter, 
  endBefore, 
  limitToLast,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { db, storage } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Label, Card, Modal } from './components/UI';
import { Tool, Supplier } from './types';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

const CATEGORIES = [
  'Elétrica',
  'Mecânica',
  'Hidráulica',
  'Ferramentas Manuais',
  'Pneumática',
  'Medição',
  'Segurança (EPI)',
  'Outros'
];

export default function ToolsPage() {
  const { user } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toolToDelete, setToolToDelete] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Pagination state
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isFirstPage, setIsFirstPage] = useState(true);
  const [isLastPage, setIsLastPage] = useState(false);
  const PAGE_SIZE = 6;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: CATEGORIES[0],
    referencePrice: '',
    contacts: ['']
  });

  const fetchTools = async (direction?: 'next' | 'prev') => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let q = query(
        collection(db, 'tools'), 
        where('userId', '==', user.uid), 
        orderBy('name', 'asc'),
        limit(PAGE_SIZE)
      );

      if (categoryFilter !== 'all') {
        q = query(
          collection(db, 'tools'),
          where('userId', '==', user.uid),
          where('category', '==', categoryFilter),
          orderBy('name', 'asc'),
          limit(PAGE_SIZE)
        );
      }

      if (direction === 'next' && lastVisible) {
        if (categoryFilter !== 'all') {
          q = query(
            collection(db, 'tools'),
            where('userId', '==', user.uid),
            where('category', '==', categoryFilter),
            orderBy('name', 'asc'),
            startAfter(lastVisible),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(
            collection(db, 'tools'),
            where('userId', '==', user.uid),
            orderBy('name', 'asc'),
            startAfter(lastVisible),
            limit(PAGE_SIZE)
          );
        }
      } else if (direction === 'prev' && firstVisible) {
        if (categoryFilter !== 'all') {
          q = query(
            collection(db, 'tools'),
            where('userId', '==', user.uid),
            where('category', '==', categoryFilter),
            orderBy('name', 'asc'),
            endBefore(firstVisible),
            limitToLast(PAGE_SIZE)
          );
        } else {
          q = query(
            collection(db, 'tools'),
            where('userId', '==', user.uid),
            orderBy('name', 'asc'),
            endBefore(firstVisible),
            limitToLast(PAGE_SIZE)
          );
        }
      }

      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docs = snap.docs;
        setFirstVisible(docs[0]);
        setLastVisible(docs[docs.length - 1]);
        setTools(docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool)));

        // Check if first page
        if (!direction) {
          setIsFirstPage(true);
        } else if (direction === 'next') {
          setIsFirstPage(false);
        } else if (direction === 'prev') {
          // If we went back, we need to check if there's anything before the new firstVisible
          const prevCheckQ = query(
            collection(db, 'tools'),
            where('userId', '==', user.uid),
            orderBy('name', 'asc'),
            endBefore(docs[0]),
            limitToLast(1)
          );
          const prevSnap = await getDocs(prevCheckQ);
          setIsFirstPage(prevSnap.empty);
        }

        // Check if last page
        const nextCheckQ = query(
          collection(db, 'tools'),
          where('userId', '==', user.uid),
          orderBy('name', 'asc'),
          startAfter(docs[docs.length - 1]),
          limit(1)
        );
        const nextSnap = await getDocs(nextCheckQ);
        setIsLastPage(nextSnap.empty);
      } else {
        if (!direction) {
          setTools([]);
          setIsFirstPage(true);
          setIsLastPage(true);
        }
      }
    } catch (err) {
      console.error('Error fetching tools:', err);
      handleFirestoreError(err, OperationType.LIST, 'tools');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'suppliers'), where('userId', '==', user.uid), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  useEffect(() => {
    fetchTools();
    fetchSuppliers();
  }, [user, categoryFilter]);

  const handleAddContact = () => {
    setFormData({ ...formData, contacts: [...formData.contacts, ''] });
  };

  const handleRemoveContact = (index: number) => {
    const newContacts = formData.contacts.filter((_, i) => i !== index);
    setFormData({ ...formData, contacts: newContacts });
  };

  const handleContactChange = (index: number, value: string) => {
    const newContacts = [...formData.contacts];
    newContacts[index] = value;
    setFormData({ ...formData, contacts: newContacts });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setError(null);

    try {
      let photoURL = editingTool?.photoURL || '';

      if (imageFile) {
        try {
          setIsCompressing(true);
          const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1280,
            useWebWorker: true
          };
          const compressedFile = await imageCompression(imageFile, options);
          setIsCompressing(false);

          const storageRef = ref(storage, `tools/${user.uid}/${Date.now()}_${imageFile.name}`);
          const uploadResult = await uploadBytes(storageRef, compressedFile);
          photoURL = await getDownloadURL(uploadResult.ref);
        } catch (uploadErr) {
          console.error('Error uploading image:', uploadErr);
          setIsCompressing(false);
          throw new Error('Erro ao processar ou enviar a imagem. Verifique sua conexão.');
        }
      }

      const price = formData.referencePrice ? parseFloat(formData.referencePrice) : 0;
      const toolData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        referencePrice: isNaN(price) ? 0 : price,
        contacts: formData.contacts.filter(c => c.trim() !== ''),
        photoURL,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      };

      if (editingTool) {
        const path = `tools/${editingTool.id}`;
        try {
          await updateDoc(doc(db, 'tools', editingTool.id!), toolData);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        try {
          await addDoc(collection(db, 'tools'), {
            ...toolData,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'tools');
        }
      }

      setIsModalOpen(false);
      setEditingTool(null);
      setImageFile(null);
      setFormData({ name: '', description: '', category: CATEGORIES[0], referencePrice: '', contacts: [''] });
      fetchTools();
    } catch (err: any) {
      console.error('Error saving tool:', err);
      let message = 'Ocorreu um erro ao salvar a ferramenta.';
      if (err.message && err.message.includes('permission-denied')) {
        message = 'Permissão negada. Verifique se você está logado corretamente.';
      } else if (err.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) message = `Erro: ${parsed.error}`;
          else message = err.message;
        } catch {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setToolToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!toolToDelete) return;
    const path = `tools/${toolToDelete}`;
    try {
      await deleteDoc(doc(db, 'tools', toolToDelete));
      fetchTools();
      setIsDeleteModalOpen(false);
      setToolToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const openEdit = (tool: Tool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      referencePrice: tool.referencePrice?.toString() || '',
      contacts: tool.contacts.length > 0 ? tool.contacts : ['']
    });
    setIsModalOpen(true);
  };

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar produtos..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              className="flex h-10 w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none appearance-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas Categorias</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
        <Button onClick={() => { setEditingTool(null); setFormData({ name: '', description: '', category: CATEGORIES[0], referencePrice: '', contacts: [''] }); setIsModalOpen(true); }} className="gap-2">
          <Plus size={20} />
          Novo Produto
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#0EA5E9]" />
          </div>
        ) : filteredTools.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Produto</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Categoria</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Preço Ref.</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Contatos</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {filteredTools.map((t) => (
                  <tr key={t.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 overflow-hidden">
                          {t.photoURL ? (
                            <img src={t.photoURL} alt={t.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Wrench size={18} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{t.name}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[200px]">{t.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-gray-900 dark:text-white font-medium">
                        <DollarSign size={14} className="text-gray-400" />
                        <span>{t.referencePrice ? t.referencePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400 text-sm">
                        <Users size={14} />
                        <span>{t.contacts.length}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(t)}>
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDeleteClick(t.id!)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-4 py-6 border-t border-gray-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchTools('prev')}
                disabled={isFirstPage}
                className="gap-2"
              >
                <ChevronLeft size={16} />
                Anterior
              </Button>
              <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
                {isFirstPage ? 'Página 1' : isLastPage ? 'Última Página' : 'Mais Produtos'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchTools('next')}
                disabled={isLastPage}
                className="gap-2"
              >
                Próxima
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="flex flex-col items-center justify-center text-gray-400">
              <AlertCircle size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Nenhum produto encontrado</p>
              <p className="text-sm">Cadastre seu primeiro produto para começar.</p>
            </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTool ? 'Editar Produto' : 'Novo Produto'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Produto</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
              required 
              placeholder="Ex: Item ou Produto Específico"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <select 
                id="category"
                className="flex h-10 w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preço de Referência</Label>
              <Input 
                id="price" 
                type="number"
                step="0.01"
                value={formData.referencePrice} 
                onChange={(e) => setFormData({ ...formData, referencePrice: e.target.value })} 
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <textarea 
              id="description"
              className="flex min-h-[80px] w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
              value={formData.description} 
              onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
              placeholder="Detalhes técnicos do produto..."
            />
          </div>

          <div className="space-y-2">
            <Label>Foto do Produto</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-gray-400 overflow-hidden">
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-full w-full object-cover" />
                ) : editingTool?.photoURL ? (
                  <img src={editingTool.photoURL} alt="Current" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon size={24} />
                )}
              </div>
              <div className="flex-1">
                <input 
                  type="file" 
                  id="photo" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('photo')?.click()}>
                  Selecionar Imagem
                </Button>
                <p className="mt-1 text-[10px] text-gray-500 dark:text-slate-500">PNG, JPG ou WEBP até 2MB</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <Label>Contatos de WhatsApp para automação</Label>
              <div className="flex gap-2">
                {suppliers.length > 0 && (
                  <select 
                    className="h-7 text-[10px] rounded-lg border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white px-2 focus:ring-[#0EA5E9] outline-none max-w-[150px]"
                    onChange={(e) => {
                      const supplier = suppliers.find(s => s.id === e.target.value);
                      if (supplier) {
                        if (!formData.contacts.includes(supplier.whatsapp)) {
                          const newContacts = formData.contacts[0] === '' ? [supplier.whatsapp] : [...formData.contacts, supplier.whatsapp];
                          setFormData({ ...formData, contacts: newContacts });
                        }
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Importar Fornecedor</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.company})</option>
                    ))}
                  </select>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={handleAddContact} className="h-7 text-[#0EA5E9]">
                  <Plus size={14} className="mr-1" /> Adicionar
                </Button>
              </div>
            </div>
            {formData.contacts.map((contact, index) => (
              <div key={index} className="flex gap-2">
                <Input 
                  value={contact} 
                  onChange={(e) => handleContactChange(index, e.target.value)} 
                  placeholder="+55 11 99999-9999"
                />
                {formData.contacts.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveContact(index)} className="text-red-500">
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-6">
            {isSaving && (
              <div className="flex items-center gap-2 text-xs text-[#0EA5E9] animate-pulse mr-auto">
                <Loader2 size={14} className="animate-spin" />
                <span>{isCompressing ? 'Otimizando imagem...' : 'Enviando dados...'}</span>
              </div>
            )}
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingTool ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl">
            <AlertCircle size={24} />
            <p className="text-sm font-medium">
              Tem certeza que deseja excluir esta ferramenta? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Excluir Produto
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
