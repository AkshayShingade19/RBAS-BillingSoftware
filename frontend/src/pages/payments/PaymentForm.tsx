import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm';

export default function PaymentFormPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Record a payment"
        subtitle="Apply a received payment to an invoice."
        actions={
          <Button variant="secondary" onClick={() => navigate('/payments')}>
            <ArrowLeft className="h-4 w-4" /> Back to payments
          </Button>
        }
      />
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-500">
          <Banknote className="h-4 w-4" />
          Choose an unpaid invoice and enter the amount received.
        </div>
        <RecordPaymentForm onSuccess={() => navigate('/payments')} onCancel={() => navigate('/payments')} />
      </Card>
    </div>
  );
}