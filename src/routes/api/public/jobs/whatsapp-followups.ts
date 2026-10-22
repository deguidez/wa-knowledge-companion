import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { processFollowups } from '@/lib/followup.server';

export const Route = createFileRoute('/api/public/jobs/whatsapp-followups')({
  server: { handlers: { POST: async ({ request }) => {
    const rejected = await authenticateCronRequest(request);
    if (rejected) return rejected;
    try {
      return Response.json(await processFollowups());
    } catch {
      return Response.json({ error: 'Não foi possível processar os lembretes' }, { status: 500 });
    }
  } } },
});