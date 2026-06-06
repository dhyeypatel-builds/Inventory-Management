export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  address: string | null;
  vehicleNo: string | null;
  notes: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface CustomerSaleSummary {
  id: string;
  invoiceNo: string;
  status: string;
  grandTotal: number;
  paymentMode: string | null;
  soldAt: string;
}

export interface CustomerDetail extends Customer {
  recentSales: CustomerSaleSummary[];
}

export interface CustomerListResponse {
  customers: Customer[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  email?: string;
  vatNumber?: string;
  address?: string;
  vehicleNo?: string;
  notes?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;
