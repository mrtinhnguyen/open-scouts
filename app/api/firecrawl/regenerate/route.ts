import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabase/server";
import { regenerateFirecrawlKey } from "@/lib/firecrawl-partner";

// Rate limit: minimum seconds between regeneration attempts
const RATE_LIMIT_SECONDS = 60;

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 },
      );
    }

    // Check rate limit - prevent regeneration within RATE_LIMIT_SECONDS
    const { data: preferences } = await supabaseServer
      .from("user_preferences")
      .select("firecrawl_key_created_at")
      .eq("user_id", user.id)
      .single();

    if (preferences?.firecrawl_key_created_at) {
      const lastCreated = new Date(preferences.firecrawl_key_created_at);
      const secondsSinceLastCreation =
        (Date.now() - lastCreated.getTime()) / 1000;

      if (secondsSinceLastCreation < RATE_LIMIT_SECONDS) {
        const waitSeconds = Math.ceil(
          RATE_LIMIT_SECONDS - secondsSinceLastCreation,
        );
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} seconds before trying again` },
          { status: 429 },
        );
      }
    }

    // Regenerate the Firecrawl API key
    const result = await regenerateFirecrawlKey(user.id, user.email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to regenerate API key" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyExisted: result.alreadyExisted,
    });
  } catch (error) {
    console.error("[API] Error regenerating Firecrawl key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
