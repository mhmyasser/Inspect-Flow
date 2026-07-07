import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { askAssistant } from "@/lib/ai-assistant.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  component: AiAssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const suggestions = [
  "ما هي أهم المخاطر التشغيلية حالياً؟",
  "اقترح إعادة توزيع للمهام المتأخرة.",
  "لخّص أداء الفريق هذا الأسبوع.",
  "أي المشاريع تحتاج تدخّل الإدارة؟",
];

function AiAssistantPage() {
  const { role, loading } = useAuth();
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const mut = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q } }),
    onSuccess: (res) => setMessages((m) => [...m, { role: "assistant", content: res.answer }]),
    onError: (e: Error) => toast.error(e.message),
  });

  function send(text: string) {
    const q = text.trim();
    if (!q || mut.isPending) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    mut.mutate(q);
  }

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/15 text-primary grid place-items-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">المساعد الذكي</h1>
          <p className="text-muted-foreground text-sm mt-1">مدعوم بـ Gemini 2.5 Flash — يحلّل بيانات نظامك الفعلية</p>
        </div>
      </div>

      <Card className="min-h-[400px]">
        <CardHeader><CardTitle className="text-base">المحادثة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">اسأل عن أي شيء في بياناتك التشغيلية:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-sm text-start p-3 rounded-md border border-border hover:bg-accent transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-md ${m.role === "user" ? "bg-primary/10 border border-primary/20" : "bg-accent/50 border border-border"}`}>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">
                {m.role === "user" ? "أنت" : "المساعد"}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
            </div>
          ))}
          {mut.isPending && (
            <div className="p-3 rounded-md bg-accent/50 border border-border text-sm text-muted-foreground">
              يفكر المساعد...
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(input); }}
          placeholder="اكتب سؤالك... (Ctrl+Enter للإرسال)"
          rows={3}
          className="resize-none"
        />
        <Button onClick={() => send(input)} disabled={!input.trim() || mut.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
