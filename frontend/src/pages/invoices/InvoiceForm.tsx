import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Invoice } from '@/lib/types';
import { DocumentForm } from '@/pages/documents/DocumentForm';
import { LoadingBlock } from '@/components/ui/Card';

export default function InvoiceFormPage() {
  const { id } = useParams();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => (await api.get<Invoice>(`/invoices/${id}`)).data,
    enabled: Boolean(id),
  });

  if (id && isLoading) return <LoadingBlock />;

  return <DocumentForm kind="invoice" doc={doc} editId={id} />;
}