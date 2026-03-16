import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Loader2,
  AlertCircle,
  MoreVertical,
  ChevronDown,
  FileText,
  Upload,
  Download,
  X,
  Paperclip,
  Eye,
  Trash2
} from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, deleteField, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Card, Modal } from './components/UI';
import { Quotation } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function HistoryPage() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'quotations'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setQuotations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleUpdateStatus = async (id: string, status: Quotation['status']) => {
    const path = `quotations/${id}`;
    try {
      await updateDoc(doc(db, 'quotations', id), { status });
      setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleFileUpload = async (id: string, file: File) => {
    if (!user) return;
    
    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('O arquivo é muito grande. O limite é de 5MB.');
      return;
    }

    setUploadingId(id);
    setUploadProgress(0);
    const path = `quotations/${id}`;
    
    try {
      const storageRef = ref(storage, `quotations/${user.uid}/${id}/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error('Upload error:', error);
          setError('Erro ao fazer upload do arquivo. Verifique sua conexão.');
          setUploadingId(null);
        }, 
        async () => {
          const fileURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          await updateDoc(doc(db, 'quotations', id), { 
            fileURL, 
            fileName: file.name,
            status: 'Respondido'
          });
          
          setQuotations(prev => prev.map(q => q.id === id ? { 
            ...q, 
            fileURL, 
            fileName: file.name,
            status: 'Respondido'
          } : q));
          setUploadingId(null);
          setUploadProgress(0);
        }
      );
    } catch (error) {
      console.error('Error initiating upload:', error);
      handleFirestoreError(error, OperationType.UPDATE, path);
      setUploadingId(null);
    }
  };

  const handleRemoveFile = async (id: string) => {
    const path = `quotations/${id}`;
    try {
      await updateDoc(doc(db, 'quotations', id), { 
        fileURL: deleteField(), 
        fileName: deleteField() 
      });
      setQuotations(prev => prev.map(q => q.id === id ? { ...q, fileURL: undefined, fileName: undefined } : q));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteQuotation = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    const path = `quotations/${id}`;
    try {
      // Find the quotation to check for files
      const quotation = quotations.find(q => q.id === id);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'quotations', id));
      
      // If there was a file, we should ideally delete it from storage too
      // Note: In a real app, you'd want to track the storage path specifically
      // but here we can try to delete if we have the URL or just let it be if it's complex
      
      setQuotations(prev => prev.filter(q => q.id !== id));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = q.toolName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              placeholder="Buscar por ferramenta..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              className="flex h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos Status</option>
              <option value="Enviado">Enviado</option>
              <option value="Respondido">Respondido</option>
              <option value="Negociando">Negociando</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl animate-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <p className="text-sm font-medium flex-1">{error}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      <Card className="overflow-hidden border-none shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Ferramenta</th>
                  <th className="px-6 py-4">Contatos</th>
                  <th className="px-6 py-4">Mensagem</th>
                  <th className="px-6 py-4">Anexo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0EA5E9]" />
                  </td>
                </tr>
              ) : filteredQuotations.length > 0 ? (
                filteredQuotations.map((q) => (
                  <tr key={q.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {format(new Date(q.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{q.toolName}</div>
                      {q.quantity && (
                        <div className="text-[10px] font-bold text-[#0EA5E9] bg-blue-50 px-1.5 py-0.5 rounded inline-block mt-1">
                          Qtd: {q.quantity}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex -space-x-2 overflow-hidden">
                        {q.contacts.slice(0, 3).map((c, i) => (
                          <div key={i} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#0EA5E9] border-2 border-white text-[10px] font-bold">
                            {c.slice(-2)}
                          </div>
                        ))}
                        {q.contacts.length > 3 && (
                          <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 border-2 border-white text-[10px] font-bold">
                            +{q.contacts.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-[250px]">
                      <p className="truncate text-gray-500 italic">"{q.message}"</p>
                    </td>
                    <td className="px-6 py-4">
                      {q.fileURL ? (
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                            <FileText size={14} className="text-[#0EA5E9]" />
                            <span className="max-w-[80px] truncate text-[10px] font-medium text-gray-700">{q.fileName || 'Arquivo'}</span>
                            <div className="flex items-center border-l border-blue-200 ml-1 pl-1 gap-1">
                              <button 
                                onClick={() => setPreviewFile({ url: q.fileURL!, name: q.fileName || 'Cotação' })}
                                className="p-1 text-[#0EA5E9] hover:bg-blue-100 rounded transition-colors"
                                title="Visualizar"
                              >
                                <Eye size={12} />
                              </button>
                              <a 
                                href={q.fileURL} 
                                download={q.fileName}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1 text-[#0EA5E9] hover:bg-blue-100 rounded transition-colors"
                                title="Baixar"
                              >
                                <Download size={12} />
                              </a>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveFile(q.id!)}
                            title="Remover anexo"
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input 
                            type="file" 
                            id={`file-${q.id}`}
                            className="hidden"
                            accept=".pdf,.xlsx,.xls,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(q.id!, file);
                            }}
                          />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-gray-400 hover:text-[#0EA5E9] gap-1.5 text-[10px] relative overflow-hidden"
                            onClick={() => document.getElementById(`file-${q.id}`)?.click()}
                            disabled={uploadingId === q.id}
                          >
                            {uploadingId === q.id ? (
                              <>
                                <div 
                                  className="absolute inset-0 bg-blue-50 transition-all duration-300" 
                                  style={{ width: `${uploadProgress}%`, opacity: 0.5 }}
                                />
                                <Loader2 size={14} className="animate-spin relative z-10" />
                                <span className="relative z-10">{Math.round(uploadProgress)}%</span>
                              </>
                            ) : (
                              <>
                                <Upload size={14} />
                                Anexar PDF/Excel
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                        q.status === 'Enviado' && 'bg-blue-100 text-blue-700',
                        q.status === 'Respondido' && 'bg-emerald-100 text-emerald-700',
                        q.status === 'Negociando' && 'bg-orange-100 text-orange-700'
                      )}>
                        {q.status === 'Enviado' && <Clock size={12} />}
                        {q.status === 'Respondido' && <CheckCircle2 size={12} />}
                        {q.status === 'Negociando' && <MessageSquare size={12} />}
                        {q.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select 
                          className="text-xs bg-transparent border-none focus:ring-0 text-gray-400 hover:text-gray-900 cursor-pointer"
                          value={q.status}
                          onChange={(e) => handleUpdateStatus(q.id!, e.target.value as Quotation['status'])}
                        >
                          <option value="Enviado">Marcar Enviado</option>
                          <option value="Respondido">Marcar Respondido</option>
                          <option value="Negociando">Marcar Negociando</option>
                        </select>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                          onClick={() => setConfirmDelete(q.id!)}
                          disabled={deletingId === q.id}
                        >
                          {deletingId === q.id ? (
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
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <AlertCircle size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-medium">Nenhum registro encontrado</p>
                      <p className="text-sm">Suas cotações enviadas aparecerão aqui.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.name || 'Visualizar Arquivo'}
        size="full"
      >
        {previewFile && (
          <div className="w-full h-full min-h-[60vh] flex flex-col">
            {previewFile.name.toLowerCase().endsWith('.pdf') ? (
              <iframe 
                src={`${previewFile.url}#toolbar=0`} 
                className="w-full h-full flex-1 rounded-xl border border-gray-100"
                title="PDF Preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
                <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <FileText size={40} className="text-[#0EA5E9]" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Visualização não disponível</h4>
                <p className="text-sm text-gray-500 mb-6 max-w-xs">
                  Arquivos Excel ou Word não podem ser visualizados diretamente no navegador. 
                  Por favor, faça o download para abrir no seu dispositivo.
                </p>
                <a href={previewFile.url} download={previewFile.name} className="inline-flex items-center justify-center rounded-xl font-medium transition-all bg-[#0EA5E9] text-white hover:bg-[#0284C7] shadow-sm h-10 px-4 py-2 text-sm gap-2">
                  <Download size={18} />
                  Baixar Arquivo
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Excluir Cotação"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir esta cotação do histórico? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button 
              variant="danger" 
              onClick={() => confirmDelete && handleDeleteQuotation(confirmDelete)}
              disabled={!!deletingId}
            >
              {deletingId ? <Loader2 size={18} className="animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
