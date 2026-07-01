import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listWebhooks, createWebhook, deleteWebhook, toggleWebhook, testWebhook, WEBHOOK_EVENTS,
} from "@/lib/webhooks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/webhooks")({
  component: WebhooksPage,
});

function WebhooksPage() {
  const list = useServerFn(listWebhooks);
  const create = useServerFn(createWebhook);
  const del = useServerFn(deleteWebhook);
  const toggle = useServerFn(toggleWebhook);
  const test = useServerFn(testWebhook);
  const qc = useQueryClient();

  const { data: hooks = [], isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, url, secret: secret || null, events: selected as typeof WEBHOOK_EVENTS[number][], active: true } }),
    onSuccess: () => {
      toast.success("تم إنشاء الـ Webhook");
      setOpen(false); setName(""); setUrl(""); setSecret(""); setSelected([]);
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground text-sm mt-1">استقبل أحداث النظام لحظياً على خدماتك الخارجية</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-2 h-4 w-4" /> إضافة Webhook</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Webhook جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>URL</Label><Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
              <div><Label>سر التوقيع (اختياري)</Label><Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="لتوقيع الطلب بـ HMAC-SHA256" /></div>
              <div>
                <Label>الأحداث</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selected.includes(ev)}
                        onCheckedChange={(v) => setSelected((s) => v ? [...s, ev] : s.filter((x) => x !== ev))}
                      />
                      <code className="text-xs">{ev}</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!name || !url || selected.length === 0 || createMut.isPending}
              >حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">القائمة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
            : hooks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">لا توجد Webhooks بعد</p>
            : hooks.map((h) => (
              <div key={h.id} className="p-4 rounded-md border border-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{h.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{h.url}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={h.active}
                      onCheckedChange={async (v) => { await toggle({ data: { id: h.id, active: v } }); qc.invalidateQueries({ queryKey: ["webhooks"] }); }}
                    />
                    <Button size="icon" variant="ghost" onClick={async () => {
                      try { await test({ data: { id: h.id } }); toast.success("تم إرسال طلب اختبار"); }
                      catch (e) { toast.error((e as Error).message); }
                    }}><Send className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm("حذف الـ Webhook؟")) return;
                      await del({ data: { id: h.id } });
                      qc.invalidateQueries({ queryKey: ["webhooks"] });
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(h.events as string[]).map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
