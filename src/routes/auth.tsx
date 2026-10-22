import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Evenon GPT" },
      { name: "description", content: "Acesse o painel do seu agente de WhatsApp." },
      { property: "og:title", content: "Entrar — Evenon GPT" },
      { property: "og:description", content: "Acesse o painel do seu agente de WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
    supabase.rpc("admin_exists").then(({ data }) => setHasAdmin(!!data));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (hasAdmin === false) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
          setHasAdmin(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  const creating = hasAdmin === false;
  return (
    <div className="bg-grid flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Evenon GPT</h1>
            <p className="text-sm text-muted-foreground">
              {creating ? "Crie a conta de administrador" : "Entre no painel"}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading || hasAdmin === null}>
          {loading ? "Aguarde..." : creating ? "Criar conta" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
