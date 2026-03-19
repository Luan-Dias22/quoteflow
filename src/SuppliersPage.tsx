import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  MessageCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Label, Card, Modal, Textarea } from './components/UI';
import { Supplier } from './types';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    whatsapp: '',
    phone: '',
    email: '',
    address: '',
    observations: ''
  });

  const fetchSuppliers = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'suppliers'), where('userId', '==', user.uid), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      handleFirestoreError(err, OperationType.LIST, 'suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setError(null);

    try {
      if (editingSupplier) {
        const path = `suppliers/${editingSupplier.id}`;
        try {
          await updateDoc(doc(db, 'suppliers', editingSupplier.id!), {
            ...formData,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        try {
          await addDoc(collection(db, 'suppliers'), {
            ...formData,
            userId: user.uid,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'suppliers');
        }
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: '', company: '', whatsapp: '', phone: '', email: '', address: '', observations: '' });
      fetchSuppliers();
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      let message = 'Ocorreu um erro ao salvar o fornecedor.';
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

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    setIsDeleting(id);
    const path = `suppliers/${id}`;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      fetchSuppliers();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsDeleting(null);
    }
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      company: supplier.company,
      whatsapp: supplier.whatsapp,
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      observations: supplier.observations || ''
    });
    setIsModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input 
            placeholder="Buscar fornecedores..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => { setEditingSupplier(null); setFormData({ name: '', company: '', whatsapp: '', phone: '', email: '', address: '', observations: '' }); setIsModalOpen(true); }} className="gap-2">
          <Plus size={20} />
          Novo Fornecedor
        </Button>
      </div>

      <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4">WhatsApp</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Endereço</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0EA5E9]" />
                  </td>
                </tr>
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((s) => (
                  <tr key={s.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">{s.name}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-500">{s.company}</div>
                    </td>
                    <td className="px-6 py-4">
                      <a 
                        href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 text-[#10B981] hover:underline font-medium"
                      >
                        <MessageCircle size={16} />
                        {s.whatsapp}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
                      {s.email ? (
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-gray-400" />
                          {s.email}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-slate-400 max-w-[200px] truncate">
                      {s.address ? (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-400" />
                          {s.address}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                          <Edit2 size={16} className="text-gray-400 group-hover:text-[#0EA5E9]" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id!)} disabled={isDeleting === s.id}>
                          {isDeleting === s.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} className="text-gray-400 group-hover:text-red-500" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <AlertCircle size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-medium">Nenhum fornecedor encontrado</p>
                      <p className="text-sm">Tente ajustar sua busca ou cadastre um novo.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Contato</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                required 
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input 
                id="company" 
                value={formData.company} 
                onChange={(e) => setFormData({ ...formData, company: e.target.value })} 
                required 
                placeholder="Ex: Ferramentas ABC"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input 
                id="whatsapp" 
                value={formData.whatsapp} 
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} 
                required 
                placeholder="+55 11 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (Opcional)</Label>
              <Input 
                id="phone" 
                value={formData.phone} 
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                placeholder="(11) 4444-4444"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email"
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
              placeholder="contato@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input 
              id="address" 
              value={formData.address} 
              onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
              placeholder="Rua Exemplo, 123 - São Paulo, SP"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea 
              id="observations"
              value={formData.observations} 
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })} 
              placeholder="Notas sobre o fornecedor..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
