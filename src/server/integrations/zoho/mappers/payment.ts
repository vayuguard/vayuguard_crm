import type { Payment } from "@prisma/client";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";

export function mapPaymentToZoho(
  payment: Payment,
  zohoCustomerId: string,
  zohoInvoiceId: string,
) {
  if (Number(payment.amount) <= 0) {
    throw new ZohoValidationError("Payment amount must be positive");
  }

  return {
    customer_id: zohoCustomerId,
    payment_mode: payment.method || "cash",
    amount: Number(payment.amount),
    date: payment.paidAt.toISOString().slice(0, 10),
    reference_number: payment.reference ?? payment.paymentNumber,
    description: payment.notes ?? undefined,
    invoices: [
      {
        invoice_id: zohoInvoiceId,
        amount_applied: Number(payment.amount),
      },
    ],
  };
}
