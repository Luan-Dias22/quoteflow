import React, { createContext, useContext, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { NotificationService } from '../services/notificationService';
import { Quotation, Lead } from '../types';

const NotificationContext = createContext({});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isInitialLoadQuots = useRef(true);
  const isInitialLoadLeads = useRef(true);

  useEffect(() => {
    if (!user) return;

    // Request permission on mount if logged in
    NotificationService.requestPermission();

    // Listen for Quotation Responses
    const qQuots = query(
      collection(db, 'quotations'),
      where('userId', '==', user.uid),
      where('status', '==', 'Respondido')
    );

    const unsubscribeQuots = onSnapshot(qQuots, (snapshot) => {
      if (isInitialLoadQuots.current) {
        isInitialLoadQuots.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        // We only notify on 'added' to the 'Respondido' query or 'modified' to it
        // If it was 'Enviado' and changed to 'Respondido', it will appear as 'added' in this filtered query
        if (change.type === 'added' || change.type === 'modified') {
          const quotation = change.doc.data() as Quotation;
          NotificationService.notify('Cotação Respondida! 📝', {
            body: `O fornecedor respondeu à cotação de: ${quotation.toolName || 'Vários itens'}`,
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
          NotificationService.notify('Novo Lead! 🚀', {
            body: `${lead.name} entrou em contato: "${lead.message.substring(0, 50)}..."`,
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
  }, [user]);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
