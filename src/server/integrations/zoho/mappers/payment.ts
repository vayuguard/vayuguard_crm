import type { Payment } from "@prisma/client";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import {
  ZOHO_PAYMENT,
  fromZohoPaymentMode,
  num,
  str,
  toZohoPaymentMode,
} from "@/server/integrations/zoho/fields";

export function mapPaymentToZoho(
  payment: Payment,
  zohoCustomerId: string,
  zohoInvoiceId: string,
) {
  if (Number(payment.amount) <= 0) {
    throw new ZohoValidationError("Payment amount must be positive");
  }

  return {
    [ZOHO_PAYMENT.customerId]: zohoCustomerId,
    [ZOHO_PAYMENT.paymentMode]: toZohoPaymentMode(payment.method),
    [ZOHO_PAYMENT.amount]: Number(payment.amount),
    [ZOHO_PAYMENT.date]: payment.paidAt.toISOString().slice(0, 10),
    [ZOHO_PAYMENT.referenceNumber]:
      payment.reference ?? payment.paymentNumber,
    [ZOHO_PAYMENT.description]: payment.notes ?? undefined,
    [ZOHO_PAYMENT.invoices]: [
      {
        [ZOHO_PAYMENT.invoiceId]: zohoInvoiceId,
        [ZOHO_PAYMENT.amountApplied]: Number(payment.amount),
      },
    ],
  };
}

/** Zoho customerpayment → CRM Payment patch (for linked records). */
export function mapZohoPaymentToCrm(zoho: Record<string, unknown>) {
  return {
    amount: num(zoho[ZOHO_PAYMENT.amount]),
    method: fromZohoPaymentMode(str(zoho[ZOHO_PAYMENT.paymentMode])),
    reference: str(zoho[ZOHO_PAYMENT.referenceNumber]),
    notes: str(zoho[ZOHO_PAYMENT.description]),
    paidAt: str(zoho[ZOHO_PAYMENT.date]),
  };
}
