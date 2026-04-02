import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/account-server";
import { AUTH_SESSION_SECRET_CONFIG_ERROR_MESSAGE, MissingAuthSessionSecretError } from "@/lib/auth/session-config";
import { DATABASE_URL_CONFIG_ERROR_MESSAGE, DatabaseConfigError } from "@/lib/db/server";

export const runtime = "nodejs";

const ROLE_ADMIN = "\u673a\u6784\u7ba1\u7406\u5458";
const NOTIFICATION_EVENTS_NOT_CONFIGURED_ERROR =
  "\u901a\u77e5\u4e8b\u4ef6\u5b58\u50a8\u672a\u542f\u7528\u3002";

async function getAdminProfile() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    }

    if (user.role !== ROLE_ADMIN) {
      return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    }

    if (!user.institutionId) {
      return { error: NextResponse.json({ error: "institution not found" }, { status: 403 }) };
    }

    return { actorId: user.id, institutionId: user.institutionId };
  } catch (error) {
    if (error instanceof MissingAuthSessionSecretError) {
      return { error: NextResponse.json({ error: AUTH_SESSION_SECRET_CONFIG_ERROR_MESSAGE }, { status: 503 }) };
    }

    if (error instanceof DatabaseConfigError) {
      return { error: NextResponse.json({ error: DATABASE_URL_CONFIG_ERROR_MESSAGE }, { status: 503 }) };
    }

    console.error("[NOTIFICATION_EVENTS] Failed to resolve admin profile", error);
    return { error: NextResponse.json({ error: "failed to load session" }, { status: 500 }) };
  }
}

function featureUnavailableResponse() {
  return NextResponse.json({ error: NOTIFICATION_EVENTS_NOT_CONFIGURED_ERROR }, { status: 503 });
}

export async function GET() {
  try {
    const context = await getAdminProfile();
    if ("error" in context) return context.error;
    return featureUnavailableResponse();
  } catch (error) {
    console.error("[NOTIFICATION_EVENTS] Unexpected GET error", error);
    return NextResponse.json({ error: NOTIFICATION_EVENTS_NOT_CONFIGURED_ERROR }, { status: 500 });
  }
}

export async function POST() {
  try {
    const context = await getAdminProfile();
    if ("error" in context) return context.error;
    return featureUnavailableResponse();
  } catch (error) {
    console.error("[NOTIFICATION_EVENTS] Unexpected POST error", error);
    return NextResponse.json({ error: NOTIFICATION_EVENTS_NOT_CONFIGURED_ERROR }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const context = await getAdminProfile();
    if ("error" in context) return context.error;
    return featureUnavailableResponse();
  } catch (error) {
    console.error("[NOTIFICATION_EVENTS] Unexpected PATCH error", error);
    return NextResponse.json({ error: NOTIFICATION_EVENTS_NOT_CONFIGURED_ERROR }, { status: 500 });
  }
}
