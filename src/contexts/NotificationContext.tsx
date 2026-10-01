import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { NotificationService } from '../services/notificationService';
import { Quotation, Lead, Supplier } from '../types';
import { MessageCircle, X, ExternalLink, Check, Bell, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'whatsapp_quote' | 'lead' | 'system';
  timestamp: string;
  read: boolean;
  quotationId?: string;
  toolName?: string;
  supplierName?: string;
  contactPhone?: string;
}

export interface NotificationContextType {
  permission: 'default' | 'granted' | 'denied' | 'unsupported';
  notifications: AppNotification[];
  unreadCount: number;
  activeToast: AppNotification | null;
  requestPermission: () => Promise<boolean>;
  dismissToast: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  triggerTestWhatsAppNotification: () => void;
  simulateWhatsAppResponse: (supplierName?: string, toolName?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  permission: 'default',
  notifications: [],
  unreadCount: 0,
  activeToast: null,
  requestPermission: async () => false,
  dismissToast: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  triggerTestWhatsAppNotification: () => {},
  simulateWhatsAppResponse: async () => {},
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(
    NotificationService.getPermissionStatus()
  );
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('quoteflow_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const isInitialLoadQuots = useRef(true);
  const isInitialLoadLeads = useRef(true);
  const suppliersCache = useRef<Supplier[]>([]);

  // Update localStorage when notifications change
  useEffect(() => {
    try {
      localStorage.setItem('quoteflow_notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch {
      // Ignore storage errors
    }
  }, [notifications]);

  // Sync permission state
  useEffect(() => {
    setPermission(NotificationService.getPermissionStatus());
  }, []);

  const requestPermission = useCallback(async () => {
    const granted = await NotificationService.requestPermission();
    setPermission(NotificationService.getPermissionStatus());
    return granted;
  }, []);

  // Fetch suppliers once for name lookup
  useEffect(() => {
    if (!user) return;
    const fetchSuppliers = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'suppliers'), where('userId', '==', user.uid)));
        suppliersCache.current = snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
      } catch (e) {
        console.error('Erro ao carregar fornecedores para notificações:', e);
      }
    };
    fetchSuppliers();
  }, [user]);

  const addNotification = useCallback((notifData: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notifData,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications(prev => [newNotif, ...prev]);
    setActiveToast(newNotif);

    // Auto-dismiss in-app toast after 8 seconds
    setTimeout(() => {
      setActiveToast(current => current?.id === newNotif.id ? null : current);
    }, 8000);

    return newNotif;
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Trigger test WhatsApp notification
  const triggerTestWhatsAppNotification = useCallback(() => {
    const sampleSuppliers = ['Usicorte Ferramentas', 'Metalúrgica Imperial', 'Distribuidora Aço & Cia', 'CNC Tools Brasil'];
    const sampleTools = ['Fresa Metal Duro 4 Cortes 6mm', 'Broca Metal Duro DIN 338 8.5mm', 'Inserto WNMG 080408', 'Macho Máquina M8'];
    const randomSupplier = sampleSuppliers[Math.floor(Math.random() * sampleSuppliers.length)];
    const randomTool = sampleTools[Math.floor(Math.random() * sampleTools.length)];

    const title = 'Cotação Recebida via WhatsApp! 💬';
    const message = `${randomSupplier} acabou de responder com a cotação para "${randomTool}".`;

    addNotification({
      title,
      message,
      type: 'whatsapp_quote',
      toolName: randomTool,
      supplierName: randomSupplier,
      contactPhone: '+55 (11) 98765-4321'
    });

    // Trigger desktop push notification
    NotificationService.notify(title, {
      body: message,
      tag: `test-whatsapp-${Date.now()}`
    });
  }, [addNotification]);

  // Simulate a realistic WhatsApp response by updating/adding in Firestore
  const simulateWhatsAppResponse = useCallback(async (supplierName?: string, toolName?: string) => {
    if (!user) return;
    const finalSupplier = supplierName || 'Fornecedor Parceiro';
    const finalTool = toolName || 'Ferramentas de Usinagem CNC';

    const title = 'Nova Cotação WhatsApp Recebida! 💬';
    const message = `${finalSupplier} respondeu sua solicitação para ${finalTool}. Preços e prazos disponíveis.`;

    addNotification({
      title,
      message,
      type: 'whatsapp_quote',
      supplierName: finalSupplier,
      toolName: finalTool
    });

    NotificationService.notify(title, {
      body: message,
      tag: `whatsapp-resp-${Date.now()}`
    });
  }, [user, addNotification]);

  // Listen for Quotation Responses in Real-time from Firestore
  useEffect(() => {
    if (!user) return;

    // Listen to quotations where status is 'Respondido' or 'Negociando'
    const qQuots = query(
      collection(db, 'quotations'),
      where('userId', '==', user.uid),
      where('status', 'in', ['Respondido', 'Negociando'])
    );

    const unsubscribeQuots = onSnapshot(qQuots, (snapshot) => {
      if (isInitialLoadQuots.current) {
        isInitialLoadQuots.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        // When quotation is added to responded status or modified
        if (change.type === 'added' || change.type === 'modified') {
          const quotation = change.doc.data() as Quotation;
          const phone = quotation.contacts && quotation.contacts[0] ? quotation.contacts[0] : '';
          
          // Match supplier name from cache
          let supplierName = '';
          if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            const found = suppliersCache.current.find(s => {
              const sClean = s.whatsapp.replace(/\D/g, '');
              return sClean && (sClean === cleanPhone || sClean.endsWith(cleanPhone) || cleanPhone.endsWith(sClean));
            });
            if (found) supplierName = found.name;
          }

          const toolTitle = quotation.toolName || (quotation.items && quotation.items.length > 0 ? quotation.items[0].toolName : 'Itens em cotação');
          const title = 'Cotação Recebida via WhatsApp! 💬';
          const body = supplierName 
            ? `${supplierName} respondeu à cotação de ${toolTitle}`
            : `Nova resposta de cotação recebida via WhatsApp para: ${toolTitle}`;

          addNotification({
            title,
            message: body,
            type: 'whatsapp_quote',
            quotationId: change.doc.id,
            toolName: toolTitle,
            supplierName: supplierName || 'Fornecedor',
            contactPhone: phone
          });

          NotificationService.notify(title, {
            body,
            tag: `quot-${change.doc.id}`,
          });
        }
      });
    }, (error) => {
      console.error("Erro ao ouvir cotações para notificações:", error);
    });

    // Listen for New Leads
    const qLeads = query(
      collection(db, 'leads'),
      where('userId', 'in', [user.uid, 'admin_demo'])
    );

    const unsubscribeLeads = onSnapshot(qLeads, (snapshot) => {
      if (isInitialLoadLeads.current) {
        isInitialLoadLeads.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const lead = change.doc.data() as Lead;
          const title = 'Novo Lead / Contato! 🚀';
          const body = `${lead.name} entrou em contato: "${lead.message.substring(0, 50)}..."`;

          addNotification({
            title,
            message: body,
            type: 'lead',
            supplierName: lead.name,
            contactPhone: lead.phone
          });

          NotificationService.notify(title, {
            body,
            tag: `lead-${change.doc.id}`,
          });
        }
      });
    }, (error) => {
      console.error("Erro ao ouvir leads para notificações:", error);
    });

    return () => {
      unsubscribeQuots();
      unsubscribeLeads();
    };
  }, [user, addNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        permission,
        notifications,
        unreadCount,
        activeToast,
        requestPermission,
        dismissToast,
        markAsRead,
        markAllAsRead,
        triggerTestWhatsAppNotification,
        simulateWhatsAppResponse,
      }}
    >
      {children}
      {/* Global In-App Push Notification Toast */}
      {activeToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-4 duration-300 drop-shadow-2xl">
          <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/80 dark:border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-500/20 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#25D366]/40">
              <MessageCircle size={22} className="fill-current" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-ping" />
                  Notificação Push • WhatsApp
                </span>
                <button
                  onClick={dismissToast}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 -mr-1 -mt-1 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <h4 className="font-extrabold text-sm text-gray-900 dark:text-white mt-0.5 truncate">
                {activeToast.title}
              </h4>
              <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">
                {activeToast.message}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <a
                  href="/history"
                  onClick={dismissToast}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                >
                  Ver no Histórico
                  <ExternalLink size={12} />
                </a>
                <button
                  onClick={dismissToast}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Dispensar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
