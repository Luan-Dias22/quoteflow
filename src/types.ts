export interface UserProfile {
  uid: string;
  companyName: string;
  cnpj?: string;
  email: string;
  photoURL?: string;
  role?: 'admin' | 'user';
}

export interface Supplier {
  id?: string;
  userId: string;
  name: string;
  company: string;
  whatsapp: string;
  phone?: string;
  email?: string;
  address?: string;
  observations?: string;
  createdAt: string;
}

export interface Tool {
  id?: string;
  userId: string;
  name: string;
  description: string;
  category: string;
  referencePrice?: number;
  photoURL?: string;
  contacts: string[];
  createdAt: string;
}

export interface QuotationItem {
  toolId: string;
  toolName: string;
  quantity: number;
}

export interface Quotation {
  id?: string;
  userId: string;
  toolId?: string;
  toolName?: string;
  quantity?: number;
  items?: QuotationItem[];
  contacts: string[];
  message: string;
  status: 'Enviado' | 'Respondido' | 'Negociando';
  fileURL?: string;
  fileName?: string;
  createdAt: string;
}

export interface Lead {
  id?: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
  status: 'Novo' | 'Em Contato' | 'Convertido' | 'Perdido';
  createdAt: string;
}
