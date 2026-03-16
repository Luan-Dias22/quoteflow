import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building2, 
  Mail, 
  Lock, 
  Camera, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { updatePassword, updateEmail } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { db, auth, storage } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { Button, Input, Label, Card } from './components/UI';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    email: ''
  });

  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        companyName: profile.companyName,
        cnpj: profile.cnpj || '',
        email: profile.email
      });
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await setDoc(doc(db, 'users', user.uid), {
        companyName: formData.companyName,
        cnpj: formData.cnpj,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await refreshProfile();
      setSuccess('Perfil atualizado com sucesso!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      
      let errorMessage = 'Erro ao atualizar perfil.';
      if (err.code === 'permission-denied') {
        errorMessage = 'Permissão negada. Verifique se você está logado corretamente.';
      } else if (err.code === 'not-found') {
        errorMessage = 'Perfil não encontrado no banco de dados.';
      } else if (err.message) {
        errorMessage = `Erro: ${err.message}`;
      }
      
      setError(errorMessage);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    try {
      setIsCompressing(true);
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 512,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      setIsCompressing(false);

      const storageRef = ref(storage, `profiles/${user.uid}`);
      const uploadResult = await uploadBytes(storageRef, compressedFile);
      const photoURL = await getDownloadURL(uploadResult.ref);
      
      await setDoc(doc(db, 'users', user.uid), { 
        photoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await refreshProfile();
      setSuccess('Foto de perfil atualizada!');
    } catch (err: any) {
      console.error('Error updating photo:', err);
      setIsCompressing(false);
      
      let errorMessage = 'Erro ao atualizar foto.';
      if (err.code === 'permission-denied') {
        errorMessage = 'Permissão negada ao atualizar foto.';
      } else if (err.message) {
        errorMessage = `Erro: ${err.message}`;
      }
      
      setError(errorMessage);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (passwordData.new !== passwordData.confirm) {
      setError('As novas senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await updatePassword(user, passwordData.new);
      setSuccess('Senha atualizada com sucesso!');
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Para mudar a senha, você precisa fazer login novamente.');
      } else {
        setError('Erro ao atualizar senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Profile Sidebar */}
        <div className="w-full md:w-1/3 space-y-6">
          <Card className="p-6 text-center">
            <div className="relative mx-auto mb-4 h-32 w-32">
              <div className="h-full w-full rounded-full border-4 border-white bg-gray-100 shadow-md overflow-hidden flex items-center justify-center">
                {isCompressing ? (
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Loader2 size={24} className="animate-spin text-[#0EA5E9]" />
                    <span className="text-[10px] font-medium text-[#0EA5E9]">Otimizando...</span>
                  </div>
                ) : profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={48} className="text-gray-300" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#0EA5E9] text-white shadow-lg hover:bg-[#0284C7] transition-colors">
                <Camera size={20} />
                <input type="file" className="hidden" accept="image/*" onChange={handleUpdatePhoto} />
              </label>
            </div>
            <h3 className="text-xl font-bold text-gray-900">{profile?.companyName}</h3>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </Card>

          {(success || error) && (
            <div className={cn(
              'flex items-center gap-3 rounded-2xl p-4 text-sm font-medium animate-in slide-in-from-top-2',
              success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
            )}>
              {success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              {success || error}
            </div>
          )}
        </div>

        {/* Profile Forms */}
        <div className="flex-1 space-y-8">
          <Card className="p-8">
            <div className="flex items-center gap-2 mb-6 text-gray-900">
              <Building2 size={20} className="text-[#0EA5E9]" />
              <h3 className="text-lg font-bold">Dados da Empresa</h3>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input 
                  id="companyName" 
                  value={formData.companyName} 
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ / CPF</Label>
                <Input 
                  id="cnpj" 
                  value={formData.cnpj} 
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (Não pode ser alterado aqui)</Label>
                <Input id="email" value={formData.email} disabled className="bg-gray-50" />
              </div>
              <div className="pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-8">
            <div className="flex items-center gap-2 mb-6 text-gray-900">
              <Lock size={20} className="text-[#0EA5E9]" />
              <h3 className="text-lg font-bold">Segurança</h3>
            </div>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  value={passwordData.new} 
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  value={passwordData.confirm} 
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })} 
                  required 
                />
              </div>
              <div className="pt-4">
                <Button type="submit" variant="outline" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : 'Alterar Senha'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
