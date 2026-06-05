import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { tripId, destination, startDate, endDate, budget, pace, interests, tuneNote } = body;

    if (!tripId || !destination) {
      return new Response(
        JSON.stringify({ error: "tripId and destination are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build date context
    let dateContext = "";
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      dateContext = `The trip runs from ${startDate} to ${endDate} (${days} days).`;
    } else if (startDate) {
      dateContext = `The trip starts on ${startDate} (assume 4 days if no end date given).`;
    } else {
      dateContext = "No specific dates given — generate a 4-day itinerary.";
    }

    const budgetDescriptions: Record<string, string> = {
      low: "budget-friendly (hostels, street food, free attractions)",
      mid: "mid-range (3-star hotels, local restaurants, paid attractions)",
      high: "luxury (5-star hotels, fine dining, private experiences)",
    };
    const paceDescriptions: Record<string, string> = {
      relaxed: "relaxed pace with only 2-3 activities per day and plenty of downtime",
      balanced: "balanced pace with 4-5 activities per day",
      packed: "action-packed with 6+ activities per day",
    };

    const interestText = interests?.length
      ? `Traveler interests: ${interests.join(", ")}.`
      : "No specific interests provided — use popular local highlights.";

    const tuneText = tuneNote
      ? `IMPORTANT ADJUSTMENT — rebuild the entire itinerary around this specific request: "${tuneNote}".`
      : "";

    const systemPrompt = `You are an opinionated, knowledgeable travel advisor.
When given a destination and preferences, you produce a detailed, specific day-by-day itinerary.
Rules:
- Choose SPECIFIC named places (real restaurants, museums, viewpoints, neighborhoods — no generic placeholders).
- Order each day geographically to minimize backtracking.
- Respect the stated budget and pace.
- Prefer fewer well-chosen, memorable stops over cramming in mediocre ones.
- Include realistic start_time values in HH:MM 24h format.
- Return ONLY valid JSON, no markdown, no code fences, no explanation.`;

    const userPrompt = `Plan a trip to ${destination}.
${dateContext}
Budget: ${budgetDescriptions[budget] || "mid-range"}.
Pace: ${paceDescriptions[pace] || "balanced"}.
${interestText}
${tuneText}

Return exactly this JSON shape:
{
  "trip_title": "string",
  "destination": "string",
  "days": [
    {
      "day_number": 1,
      "summary": "one sentence describing the day's theme",
      "activities": [
        {
          "title": "string",
          "category": "food|sightseeing|activity|transit|rest",
          "location": "string",
          "start_time": "HH:MM",
          "notes": "string (1-2 sentences with specific tips)",
          "sort_order": 1
        }
      ]
    }
  ]
}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from OpenAI" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let itinerary: {
      trip_title: string;
      destination: string;
      days: Array<{
        day_number: number;
        summary: string;
        activities: Array<{
          title: string;
          category: string;
          location: string;
          start_time: string;
          notes: string;
          sort_order: number;
        }>;
      }>;
    };

    try {
      itinerary = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response as JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!itinerary.days || !Array.isArray(itinerary.days)) {
      return new Response(
        JSON.stringify({ error: "AI response missing days array" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete existing activities for this trip (in case of regeneration)
    await supabase.from("activities").delete().eq("trip_id", tripId);

    // Insert all activities
    const activitiesToInsert = itinerary.days.flatMap((day) =>
      (day.activities || []).map((act) => ({
        trip_id: tripId,
        day_number: day.day_number,
        title: act.title || "Activity",
        location: act.location || "",
        start_time: act.start_time || "",
        category: ["food", "sightseeing", "activity", "transit", "rest"].includes(act.category)
          ? act.category
          : "activity",
        notes: act.notes || "",
        sort_order: act.sort_order ?? 0,
      }))
    );

    const { error: insertError } = await supabase
      .from("activities")
      .insert(activitiesToInsert);

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Failed to save activities: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ trip: itinerary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
