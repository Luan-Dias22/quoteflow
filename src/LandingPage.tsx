import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, CheckCircle, Zap, Shield, ArrowRight, Users, History, LayoutDashboard, Send, Loader2, Mail, Phone, User, AlertCircle } from 'lucide-react';
import { Button, Input, Textarea } from './components/UI';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'leads'), {
        ...formData,
        userId: 'admin_demo', // For demo purposes, or we could leave it empty if it's a global lead
        source: 'Landing Page',
        status: 'Novo Pedido',
        createdAt: new Date().toISOString()
      });
      console.log("Lead submitted successfully with ID:", docRef.id);
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (error) {
      console.error('Error submitting lead:', error);
      setError('Ocorreu um erro ao enviar sua mensagem. Por favor, tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30 transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-50 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
              <MessageSquare size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">QuoteFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/login')}>Entrar</Button>
            <Button onClick={() => navigate('/register')}>Criar Conta</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent blur-3xl" />
        
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 text-sm font-medium text-[#0EA5E9] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap size={16} />
            <span>Novo: Automação via WhatsApp 2.0</span>
          </div>
          
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-7xl lg:leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Cotações inteligentes em segundos <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#0EA5E9] to-[#10B981] bg-clip-text text-transparent">pelo WhatsApp.</span>
          </h1>
          
          <p className="mx-auto mt-8 max-w-2xl text-lg text-gray-600 dark:text-slate-400 sm:text-xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            A plataforma definitiva para empresas que buscam agilidade na gestão de suprimentos e compras. 
            Gerencie fornecedores, produtos e envie cotações automáticas com um clique.
          </p>
          
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300">
            <Button size="lg" className="h-14 px-10 text-lg shadow-xl shadow-blue-200 dark:shadow-blue-900/20" onClick={() => navigate('/register')}>
              Começar agora grátis
              <ArrowRight size={20} className="ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg" onClick={() => navigate('/login')}>
              Ver demonstração
            </Button>
          </div>

          <div className="mt-20 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl animate-in fade-in zoom-in duration-1000 delay-500">
            <img 
              src="https://picsum.photos/seed/autocota-dashboard/1200/600" 
              alt="Dashboard Preview" 
              className="rounded-2xl w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-slate-900/50 py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">Tudo o que você precisa para escalar</h2>
            <p className="mt-4 text-gray-600 dark:text-slate-400">Funcionalidades pensadas para o dia a dia da sua operação.</p>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Gestão de Fornecedores', desc: 'Mantenha todos os seus contatos organizados em um só lugar.', icon: Users },
              { title: 'Catálogo de Produtos', desc: 'Cadastre seus itens com fotos, especificações e categorias específicas.', icon: MessageSquare },
              { title: 'Automação WhatsApp', desc: 'Envie cotações personalizadas para múltiplos fornecedores instantaneamente.', icon: MessageSquare },
              { title: 'Histórico Completo', desc: 'Acompanhe todas as cotações enviadas e seus status de resposta.', icon: History },
              { title: 'Segurança de Dados', desc: 'Seus dados estão protegidos e isolados por conta.', icon: Shield },
              { title: 'Relatórios Inteligentes', desc: 'Visualize estatísticas de envios e taxas de conversão.', icon: LayoutDashboard },
            ].map((feature, i) => (
              <div key={i} className="group rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 transition-all hover:shadow-xl hover:-translate-y-1">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-[#0EA5E9] group-hover:bg-[#0EA5E9] group-hover:text-white transition-colors">
                  <feature.icon size={24} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form / Lead Generation */}
      <section className="py-24 bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">Ficou com alguma dúvida?</h2>
              <p className="text-lg text-gray-600 dark:text-slate-400 mb-8 leading-relaxed">
                Nossa equipe está pronta para te ajudar a transformar sua gestão de compras. 
                Preencha o formulário e entraremos em contato o mais rápido possível.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-[#0EA5E9]">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">Atendimento Personalizado</h4>
                    <p className="text-gray-500 dark:text-slate-400">Suporte humano e dedicado.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-[#0EA5E9]">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">Implementação Rápida</h4>
                    <p className="text-gray-500 dark:text-slate-400">Comece a usar em menos de 5 minutos.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl shadow-blue-100 dark:shadow-none">
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium flex items-center gap-2 border border-red-100 dark:border-red-800/30">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
              {submitted ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500">
                    <CheckCircle size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Mensagem Enviada!</h3>
                  <p className="text-gray-600 dark:text-slate-400 mb-8">Obrigado pelo interesse. Nossa equipe entrará em contato em breve.</p>
                  <Button variant="outline" onClick={() => setSubmitted(false)}>Enviar outra mensagem</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input 
                        required
                        className="pl-10 h-12"
                        placeholder="Seu nome"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-slate-300">E-mail</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input 
                          required
                          type="email"
                          className="pl-10 h-12"
                          placeholder="seu@email.com"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-slate-300">WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input 
                          required
                          className="pl-10 h-12"
                          placeholder="(00) 00000-0000"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Como podemos ajudar?</label>
                    <Textarea 
                      required
                      className="min-h-[120px]"
                      placeholder="Conte-nos um pouco sobre sua necessidade..."
                      value={formData.message}
                      onChange={e => setFormData({...formData, message: e.target.value})}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full h-14 text-lg shadow-xl shadow-blue-200 dark:shadow-blue-900/20"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        Falar com Especialista
                        <Send size={20} className="ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-slate-800 py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white">
              <MessageSquare size={18} />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">QuoteFlow</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">© 2026 QuoteFlow. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">Termos</a>
            <a href="#" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
