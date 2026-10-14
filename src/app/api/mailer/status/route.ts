import { NextResponse } from "next/server";
import { mailerService } from "../../../../lib/mailer-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = mailerService.getState();
  const contacts = mailerService.getContacts();
  const templates = mailerService.getTemplates();

  return NextResponse.json({
    success: true,
    state,
    contacts,
    templates,
  });
}
