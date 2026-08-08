import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ContactsView } from "@/features/contacts/contacts-view";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        title="Contacts"
        description="People associated with your customers and leads."
      />
      <ContactsView />
    </>
  );
}
