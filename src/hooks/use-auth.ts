import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface UserWithRole {
  user: User | null;
  role: "admin" | "employee" | null;
  loading: boolean;
}

export function useAuth(): UserWithRole {
  const [state, setState] = useState<UserWithRole>({ user: null, role: null, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setState({ user: null, role: null, loading: false });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const role = roles?.find((r) => r.role === "admin") ? "admin" : "employee";
      if (!cancelled) setState({ user, role, loading: false });
    }

    void load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
