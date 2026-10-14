import { NextRequest, NextResponse } from "next/server";
import { mailerService } from "../../../../lib/mailer-service";
import type { MailerContact } from "../../../../types/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "launch": {
        const instanceId = body.instanceId === "2" ? "2" : "1";
        const status = await mailerService.launchInstance(instanceId);
        return NextResponse.json({ success: true, status });
      }

      case "close": {
        const instanceId = body.instanceId === "2" ? "2" : "1";
        await mailerService.closeInstance(instanceId);
        return NextResponse.json({ success: true });
      }

      case "start": {
        if (body.config) {
          mailerService.updateConfig(body.config);
        }
        await mailerService.startAutomation();
        return NextResponse.json({
          success: true,
          state: mailerService.getState(),
        });
      }

      case "pause": {
        mailerService.pauseAutomation();
        return NextResponse.json({
          success: true,
          state: mailerService.getState(),
        });
      }

      case "resume": {
        mailerService.resumeAutomation();
        return NextResponse.json({
          success: true,
          state: mailerService.getState(),
        });
      }

      case "stop": {
        mailerService.stopAutomation();
        return NextResponse.json({
          success: true,
          state: mailerService.getState(),
        });
      }

      case "set_contacts": {
        const contacts: MailerContact[] = Array.isArray(body.contacts)
          ? body.contacts
          : [];
        mailerService.setContacts(contacts);
        return NextResponse.json({
          success: true,
          count: contacts.length,
        });
      }

      case "update_config": {
        mailerService.updateConfig(body.config || {});
        return NextResponse.json({
          success: true,
          state: mailerService.getState(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
