import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_SECTIONS = ["fed", "geopolitics", "commodities", "jobs", "government"];
const MAX_SECTIONS = 5;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = claimsData.claims.sub as string;

    const { data: prefs } = await supabase
      .from("macro_preferences")
      .select("enabled_sections")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      enabledSections: prefs?.enabled_sections ?? VALID_SECTIONS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = claimsData.claims.sub as string;
    const body = await request.json();
    const sections: unknown = body.enabledSections;

    if (!Array.isArray(sections) || sections.length === 0 || sections.length > MAX_SECTIONS) {
      return NextResponse.json(
        { error: `enabledSections must be an array of 1-${MAX_SECTIONS} valid section IDs` },
        { status: 400 }
      );
    }

    const validated = sections.filter(
      (s): s is string => typeof s === "string" && VALID_SECTIONS.includes(s)
    );

    if (validated.length === 0) {
      return NextResponse.json(
        { error: `No valid sections provided. Valid: ${VALID_SECTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabase
      .from("macro_preferences")
      .upsert(
        {
          user_id: userId,
          enabled_sections: validated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ enabledSections: validated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update preferences" },
      { status: 500 }
    );
  }
}
