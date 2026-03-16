import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, CheckCircle, Zap, Shield, ArrowRight } from 'lucide-react';
import { Button } from './components/UI';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white shadow-lg shadow-blue-200">
              <Wrench size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">AutoCota</span>
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
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-[#0EA5E9] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap size={16} />
            <span>Novo: Automação via WhatsApp 2.0</span>
          </div>
          
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-gray-900 sm:text-7xl lg:leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Cote ferramentas em segundos <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#0EA5E9] to-[#10B981] bg-clip-text text-transparent">pelo WhatsApp.</span>
          </h1>
          
          <p className="mx-auto mt-8 max-w-2xl text-lg text-gray-600 sm:text-xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            A plataforma definitiva para empresas que buscam agilidade na compra de ferramentas. 
            Gerencie fornecedores, ferramentas e envie cotações automáticas com um clique.
          </p>
          
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300">
            <Button size="lg" className="h-14 px-10 text-lg shadow-xl shadow-blue-200" onClick={() => navigate('/register')}>
              Começar agora grátis
              <ArrowRight size={20} className="ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg" onClick={() => navigate('/login')}>
              Ver demonstração
            </Button>
          </div>

          <div className="mt-20 rounded-3xl border border-gray-100 bg-white p-2 shadow-2xl animate-in fade-in zoom-in duration-1000 delay-500">
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
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Tudo o que você precisa para escalar</h2>
            <p className="mt-4 text-gray-600">Funcionalidades pensadas para o dia a dia da sua operação.</p>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Gestão de Fornecedores', desc: 'Mantenha todos os seus contatos organizados em um só lugar.', icon: Users },
              { title: 'Catálogo de Ferramentas', desc: 'Cadastre suas ferramentas com fotos e categorias específicas.', icon: Wrench },
              { title: 'Automação WhatsApp', desc: 'Envie cotações personalizadas para múltiplos fornecedores instantaneamente.', icon: MessageSquare },
              { title: 'Histórico Completo', desc: 'Acompanhe todas as cotações enviadas e seus status de resposta.', icon: History },
              { title: 'Segurança de Dados', desc: 'Seus dados estão protegidos e isolados por conta.', icon: Shield },
              { title: 'Relatórios Inteligentes', desc: 'Visualize estatísticas de envios e taxas de conversão.', icon: LayoutDashboard },
            ].map((feature, i) => (
              <div key={i} className="group rounded-3xl border border-gray-100 bg-white p-8 transition-all hover:shadow-xl hover:-translate-y-1">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0EA5E9] group-hover:bg-[#0EA5E9] group-hover:text-white transition-colors">
                  <feature.icon size={24} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#10B981] text-white">
              <Wrench size={18} />
            </div>
            <span className="text-lg font-bold text-gray-900">AutoCota</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 AutoCota. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Termos</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { LayoutDashboard, Users, MessageSquare, History } from 'lucide-react';
