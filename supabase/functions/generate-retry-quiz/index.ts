
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
    const { subunit_id, subunit_title, parent_module_id, incorrect_questions } = await req.json();

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }
    if (!subunit_id || !subunit_title || !incorrect_questions?.length || !parent_module_id) {
      throw new Error("Missing required parameters");
    }

    // 1. Extract missed concepts/keywords via GPT
    const extractPrompt = `
From the following incorrectly answered quiz questions (with their text), extract the main concept, skill or keyword each one tests. 
List these as a simple JSON array of concept strings. Only output the array, not prose or explanation.

Questions:
${JSON.stringify(incorrect_questions)}
`;

    const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: "system", content: "Extract key concepts from educational quiz question text."},
          { role: "user", content: extractPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });
    const extractData = await extractRes.json();
    let keywordsRaw = extractData.choices?.[0]?.message?.content || "";
    let concepts: string[] = [];
    try {
      concepts = JSON.parse(keywordsRaw);
    } catch (e) {
      // Fallback, try to parse bracketed list
      concepts = (keywordsRaw.match(/"(.*?)"/g) || []).map(s => s.replace(/"/g, ""));
    }

    if (!concepts.length) {
      throw new Error("Could not extract any key concepts from incorrect questions.");
    }

    // 2. Regenerate new quiz questions on those concepts
    const quizGenPrompt = `
You are a curriculum designer. For a targeted retry mini-quiz, generate 2-3 new multiple-choice questions specifically testing the following concepts: ${concepts.join(", ")}.
For each question: 
- Provide "question_text", "options" (a list), and "correct_option" (must match one in options).
- Output ONLY a JSON array of these new questions.
- No prose, no markdown code block. 
`;

    const quizRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: "Design focused retry-quiz questions."},
          { role: 'user', content: quizGenPrompt }
        ],
        temperature: 0.55,
        max_tokens: 1400,
      }),
    });
    const quizData = await quizRes.json();
    let quizQuestionsRaw = quizData.choices?.[0]?.message?.content || "";
    let retryQuiz: any[] = [];
    try {
      retryQuiz = JSON.parse(quizQuestionsRaw);
    } catch (e) {
      // Try to parse from a Markdowned JSON block
      quizQuestionsRaw = quizQuestionsRaw.replace(/^```json|```$/gm, '').trim();
      retryQuiz = JSON.parse(quizQuestionsRaw);
    }

    if (!retryQuiz || !Array.isArray(retryQuiz) || retryQuiz.length === 0) {
      throw new Error("No retry quiz questions could be generated.");
    }

    // 3. Store as new mini-quiz module in Supabase
    // Compose the module content
    const moduleContent = {
      status: "ready",
      questions: retryQuiz
    };

    // Insert the retry quiz module
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
        title: `Retry: ${subunit_title}`,
        type: "quiz",
        content_json: moduleContent,
        parent_module_id,
        order: 100 // Arbitrary; appears at end for now
      }])
    });
    if (!createModuleRes.ok) {
      const error = await createModuleRes.json();
      throw new Error(`Unable to create retry quiz module: ${JSON.stringify(error)}`);
    }

    const moduleData = await createModuleRes.json();
    const retry_quiz_module_id = moduleData[0]?.id;

    return new Response(JSON.stringify({
      message: "Retry mini-quiz created for missed concepts.",
      retry_quiz_module_id,
      quiz: retryQuiz,
      concepts: concepts
    }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (err) {
    console.error("Error in generate-retry-quiz:", err);
    return new Response(JSON.stringify({ 
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200, // Use status 200 to avoid Edge Function error
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
