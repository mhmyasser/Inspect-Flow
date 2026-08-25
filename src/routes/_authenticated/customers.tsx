import { createFileRoute } from "@tanstack/react-router";
import { ContactsList } from "@/components/contacts/contacts-list";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "العملاء — إدارة المشاريع التجارية" },
      { name: "description", content: "سجل العملاء ومعاملاتهم ومرفقاتهم." },
      { property: "og:title", content: "العملاء — إدارة المشاريع التجارية" },
      { property: "og:description", content: "سجل العملاء ومعاملاتهم ومرفقاتهم." },
      { property: "og:url", content: "https://inspect-flow-master.lovable.app/customers" },
      { name: "twitter:title", content: "العملاء — إدارة المشاريع التجارية" },
      { name: "twitter:description", content: "سجل العملاء ومعاملاتهم ومرفقاتهم." },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://inspect-flow-master.lovable.app/customers" }],
  }),
  component: () => <ContactsList kind="customer" />,
});
