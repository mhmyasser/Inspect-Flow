import { createFileRoute } from "@tanstack/react-router";
import { ContactsList } from "@/components/contacts/contacts-list";

export const Route = createFileRoute("/_authenticated/customers")({
  component: () => <ContactsList kind="customer" />,
});
