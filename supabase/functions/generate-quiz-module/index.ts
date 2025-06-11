
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subunit_id, subunit_title, learning_goal } = await req.json();

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    if (!subunit_id || !subunit_title || !learning_goal) {
      throw new Error("Missing required parameters");
    }

    // Compose GPT prompt:
    const quizPrompt = `
You are an expert instructional designer. Write a quiz for learners about "${subunit_title}" to assess they can "${learning_goal}".
Generate 6–8 questions. Diversify types as much as possible, selecting from:
- mcq (multiple choice)
- fitb (fill in the blank)
- drag_match (match term to definition)
- sequence (order the steps)
- summary (short text answer)

For each question, provide:
{
  type: (one of "mcq", "fitb", "drag_match", "sequence", "summary"),
  question: "...",
  choices: (array of strings, only for mcq/fitb/sequence; null for others),
  correct_answer: (string or array, as appropriate),
  explanation: (string)
}

Output a single JSON array, no extra commentary.
`;

    // Call OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You help design diverse and high-quality quiz questions for learners." },
          { role: "user", content: quizPrompt }
        ],
        temperature: 0.6,
        max_tokens: 2200,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.json();
      throw new Error(`OpenAI error: ${JSON.stringify(err)}`);
    }
    const aiData = await openaiRes.json();
    let quizQuestions = [];
    let contentText = aiData.choices?.[0]?.message?.content || "";

    try {
      // Remove markdown code blocks if present
      contentText = contentText.replace(/^```json|```$/gm, '').trim();
      quizQuestions = JSON.parse(contentText);
    } catch (err) {
      console.error("JSON parse error. Raw content:", contentText);
      throw new Error("Quiz questions are not valid JSON.");
    }

    // === Begin Validation Step ===
    const requiredTypes = ["mcq", "fitb", "drag_match", "sequence", "summary"];
    const typesUsed = new Set();
    let invalidQuestion = false;
    let invalidQuestionsList = [];
    quizQuestions.forEach((q, i) => {
      if (q && q.type) typesUsed.add(q.type);
      if (
        (q.correct_answer === undefined || q.correct_answer === null || q.correct_answer === "" || (Array.isArray(q.correct_answer) && q.correct_answer.length === 0)) ||
        !q.explanation ||
        q.explanation.toString().trim().length === 0
      ) {
        invalidQuestion = true;
        invalidQuestionsList.push(i);
      }
    });

    if (typesUsed.size < 3) {
      return new Response(JSON.stringify({
        status: 'error',
        error: "Validation failed: Less than 3 different question types found",
        details: { typesUsed: Array.from(typesUsed) }
      }), {
        status: 200, // Return 200 to avoid Edge Function error
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (invalidQuestion) {
      return new Response(JSON.stringify({
        status: 'error',
        error: "Validation failed: Missing correct_answer or explanation in one or more questions.",
        invalidQuestions: invalidQuestionsList
      }), {
        status: 200, // Return 200 to avoid Edge Function error
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    // === End Validation Step ===

    // Prepare module content
    const moduleContent = {
      status: "generating",
      questions: quizQuestions
    };

    // Insert the quiz module
    const createModuleRes = await fetch(`${SUPABASE_URL}/rest/v1/modules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify([{
        subunit_id,
        title: `Quiz: ${subunit_title}`,
        type: "quiz",
        content_json: moduleContent,
        order: 99 // Arbitrary; update ordering later as needed
      }])
    });
    if (!createModuleRes.ok) {
      const error = await createModuleRes.json();
      throw new Error(`Unable to create quiz module in database: ${JSON.stringify(error)}`);
    }

    const moduleData = await createModuleRes.json();
    const module_id = moduleData[0]?.id;

    // If validation passed, now update status to ready (PATCH)
    const readyContent = {
      ...moduleContent,
      status: "ready"
    };
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/modules?id=eq.${module_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        content_json: readyContent,
        // Title remains as 'Quiz: ...', but update if needed
        title: `Quiz: ${subunit_title}`
      })
    });

    if (!patchRes.ok) {
      const patchErr = await patchRes.json();
      return new Response(JSON.stringify({
        status: 'error',
        error: "Failed to update quiz module status to ready.",
        details: patchErr
      }), {
        status: 200, // Return 200 to avoid Edge Function error
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const finalModule = await patchRes.json();

    return new Response(JSON.stringify({
      message: "Quiz module generated, validated, and status set to ready!",
      quiz: quizQuestions,
      module_id: module_id
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error in generate-quiz-module:", err);
    return new Response(JSON.stringify({ 
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200, // Return 200 to avoid Edge Function error
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
