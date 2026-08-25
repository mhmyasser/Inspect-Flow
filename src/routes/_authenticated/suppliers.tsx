import { createFileRoute } from "@tanstack/react-router";
import { ContactsList } from "@/components/contacts/contacts-list";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "الموردون — إدارة المشاريع التجارية" },
      { name: "description", content: "سجل الموردين ومعاملاتهم ومرفقاتهم." },
      { property: "og:title", content: "الموردون — إدارة المشاريع التجارية" },
      { property: "og:description", content: "سجل الموردين ومعاملاتهم ومرفقاتهم." },
      { property: "og:url", content: "https://inspect-flow-master.lovable.app/suppliers" },
      { name: "twitter:title", content: "الموردون — إدارة المشاريع التجارية" },
      { name: "twitter:description", content: "سجل الموردين ومعاملاتهم ومرفقاتهم." },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://inspect-flow-master.lovable.app/suppliers" }],
  }),
  component: () => <ContactsList kind="supplier" />,
});
