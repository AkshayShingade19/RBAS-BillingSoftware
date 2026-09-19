import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Quote } from '@/lib/types';
import { DocumentForm } from '@/pages/documents/DocumentForm';
import { LoadingBlock } from '@/components/ui/Card';

export default function QuoteFormPage() {
  const { id } = useParams();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['quotes', id],
    queryFn: async () => (await api.get<Quote>(`/quotes/${id}`)).data,
    enabled: Boolean(id),
  });

  if (id && isLoading) return <LoadingBlock />;

  return <DocumentForm kind="quote" doc={doc} editId={id} />;
}