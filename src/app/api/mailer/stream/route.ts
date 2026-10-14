import { mailerService } from "../../../../lib/mailer-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller might be closed
        }
      };

      // Send initial state
      sendEvent("state", mailerService.getState());

      // Subscribe to live events
      unsubscribe = mailerService.subscribe((event, data) => {
        sendEvent(event, data);
      });

      // Keepalive ping every 15s to keep connection alive
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          if (pingInterval) clearInterval(pingInterval);
          if (unsubscribe) unsubscribe();
        }
      }, 15000);
    },
    cancel() {
      // Clean up subscription and ping timer when client disconnects
      if (unsubscribe) unsubscribe();
      if (pingInterval) clearInterval(pingInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
