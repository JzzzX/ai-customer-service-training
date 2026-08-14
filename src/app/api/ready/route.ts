import { checkApplicationReadiness } from "@/lib/runtime/health";

export async function GET(): Promise<Response> {
  try {
    return Response.json(checkApplicationReadiness());
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
