/**
 * Wipes CRM operational / demo data while keeping system accounts:
 * users, roles, permissions, company settings, pipeline stages.
 *
 * Usage: npx tsx prisma/wipe-crm-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function wipe() {
  console.log("Wiping CRM data (keeping users, roles, settings, pipeline)…");

  // Order matters: child tables first.
  const steps: { label: string; run: () => Promise<unknown> }[] = [
    { label: "payments", run: () => prisma.payment.deleteMany() },
    { label: "invoice items", run: () => prisma.invoiceItem.deleteMany() },
    { label: "invoices", run: () => prisma.invoice.deleteMany() },
    { label: "quotation items", run: () => prisma.quotationItem.deleteMany() },
    {
      label: "quotation versions",
      run: () => prisma.quotationVersion.deleteMany(),
    },
    { label: "quotations", run: () => prisma.quotation.deleteMany() },
    { label: "ticket messages", run: () => prisma.ticketMessage.deleteMany() },
    { label: "support tickets", run: () => prisma.supportTicket.deleteMany() },
    {
      label: "campaign recipients",
      run: () => prisma.campaignRecipient.deleteMany(),
    },
    { label: "campaign metrics", run: () => prisma.campaignMetric.deleteMany() },
    { label: "campaigns", run: () => prisma.campaign.deleteMany() },
    {
      label: "deal stage history",
      run: () => prisma.dealStageHistory.deleteMany(),
    },
    { label: "deals", run: () => prisma.deal.deleteMany() },
    { label: "task recurrence", run: () => prisma.taskRecurrence.deleteMany() },
    { label: "tasks", run: () => prisma.task.deleteMany() },
    { label: "todo items", run: () => prisma.todoItem.deleteMany() },
    { label: "todo lists", run: () => prisma.todoList.deleteMany() },
    { label: "reminders", run: () => prisma.reminder.deleteMany() },
    { label: "meetings", run: () => prisma.meeting.deleteMany() },
    { label: "calendar events", run: () => prisma.calendarEvent.deleteMany() },
    { label: "lead tags", run: () => prisma.leadTag.deleteMany() },
    { label: "lead attachments", run: () => prisma.leadAttachment.deleteMany() },
    { label: "lead activities", run: () => prisma.leadActivity.deleteMany() },
    { label: "leads", run: () => prisma.lead.deleteMany() },
    { label: "contact tags", run: () => prisma.contactTag.deleteMany() },
    { label: "contacts", run: () => prisma.contact.deleteMany() },
    { label: "projects", run: () => prisma.project.deleteMany() },
    { label: "customers", run: () => prisma.customer.deleteMany() },
    { label: "products", run: () => prisma.product.deleteMany() },
    {
      label: "product categories",
      run: () => prisma.productCategory.deleteMany(),
    },
    { label: "tags", run: () => prisma.tag.deleteMany() },
    { label: "communications", run: () => prisma.communication.deleteMany() },
    {
      label: "document versions",
      run: () => prisma.documentVersion.deleteMany(),
    },
    { label: "documents", run: () => prisma.document.deleteMany() },
    { label: "notifications", run: () => prisma.notification.deleteMany() },
    { label: "mentions", run: () => prisma.mention.deleteMany() },
    { label: "sales targets", run: () => prisma.salesTarget.deleteMany() },
    { label: "attendance", run: () => prisma.attendance.deleteMany() },
    { label: "commissions", run: () => prisma.commission.deleteMany() },
    { label: "saved views", run: () => prisma.savedView.deleteMany() },
    {
      label: "custom field values",
      run: () => prisma.customFieldValue.deleteMany(),
    },
    { label: "AI insights", run: () => prisma.aiInsight.deleteMany() },
  ];

  for (const step of steps) {
    const result = (await step.run()) as { count: number };
    console.log(`  cleared ${step.label}: ${result.count}`);
  }

  console.log("Done. Dashboard and CRM modules should now be empty.");
  console.log("Users, roles, company settings, and pipeline stages were kept.");
}

wipe()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
