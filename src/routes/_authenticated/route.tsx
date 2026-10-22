import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bot, KeyRound, LogOut, MessageCircle, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const nav = [
  { to: "/dashboard", label: "Conversas", icon: MessagesSquare },
  { to: "/conhecimento", label: "Conhecimento", icon: BookOpen },
  { to: "/agente", label: "Agente", icon: Bot },
  { to: "/chaves", label: "Chaves de API", icon: KeyRound },
] as const;

function Layout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 max-md:w-16 max-md:px-2">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold max-md:hidden">Evenon GPT</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary font-semibold" }}
            >
              <n.icon className="h-4 w-4 shrink-0" />
              <span className="max-md:hidden">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <p className="truncate px-3 text-xs text-muted-foreground max-md:hidden">{user.email}</p>
          <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
            <span className="max-md:hidden">Sair</span>
          </button>
        </div>
      </aside>
      <main className="bg-grid min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
