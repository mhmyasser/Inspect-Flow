import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchContacts } from "@/lib/contacts.functions";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface Props {
  kind: "customer" | "supplier";
  value: string;
  onChange: (name: string, id: string | null) => void;
  placeholder?: string;
  id?: string;
}

export function ContactAutocomplete({ kind, value, onChange, placeholder, id }: Props) {
  const search = useServerFn(searchContacts);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; name: string; company: string | null }>>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await search({ data: { kind, query: value } });
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, kind, open, search]);

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value, null); setOpen(true); }}
        autoComplete="off"
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
          {loading && (
            <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> جاري البحث…
            </div>
          )}
          {!loading && results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="block w-full text-right px-3 py-2 text-sm hover:bg-accent"
              onClick={() => { onChange(r.name, r.id); setOpen(false); }}
            >
              <div className="font-medium">{r.name}</div>
              {r.company && <div className="text-xs text-muted-foreground">{r.company}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
