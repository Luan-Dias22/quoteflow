import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Wrench, Mail, Lock, Loader2, ArrowLeft, Building2, User } from 'lucide-react';
import { auth, db } from './firebase';
import { Button, Input, Label, Card } from './components/UI';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    cnpj: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Create user profile in Firestore
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          companyName: formData.companyName,
          email: formData.email,
          cnpj: formData.cnpj,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Registration error:', err);
      
      let errorMessage = 'Ocorreu um erro ao criar sua conta. Tente novamente.';
      
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          errorMessage = `Erro de banco de dados: ${parsed.operationType} em ${parsed.path}.`;
        }
      } catch {
        // Not a JSON error
        if (err.code === 'auth/email-already-in-use') {
          errorMessage = 'Este e-mail já está em uso.';
        } else if (err.code === 'auth/invalid-email') {
          errorMessage = 'E-mail inválido.';
        } else if (err.code === 'auth/weak-password') {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
        } else if (err.code === 'auth/operation-not-allowed') {
          errorMessage = 'O cadastro com e-mail e senha não está habilitado no Firebase.';
        } else if (err.message) {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={16} />
          Voltar para o início
        </Link>

        <Card className="p-8 shadow-xl border-none">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white shadow-lg shadow-blue-200">
              <Wrench size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Crie sua conta</h1>
            <p className="mt-2 text-sm text-gray-500">Comece a automatizar suas cotações hoje mesmo.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  id="companyName"
                  placeholder="Sua Empresa Ltda"
                  className="pl-10"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail Corporativo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ / CPF (Opcional)</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Criar Conta'}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            Já tem uma conta?{' '}
            <Link to="/login" className="font-semibold text-[#0EA5E9] hover:underline">
              Faça login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
