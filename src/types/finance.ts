export type TransactionType = 'inflow' | 'outflow';
export type UserRole = 'admin' | 'member' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  client_name: string;
  role: UserRole;
}

export interface Transaction {
  id: string;
  user_id?: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  source?: string;
  created_at?: string;
}

export interface Debt {
  id: string;
  user_id?: string;
  platform: string;
  contract_no: string | null;
  total_tenor: number | null;
  remaining_tenor: number | null;
  due_day: number | null;
  remaining_balance: number;
  monthly_installment: number;
  status: 'active' | 'paid_off';
  notes: string | null;
  created_at?: string;
}

export interface AIScanResult {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
}
