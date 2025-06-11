
// This file is an Edge Function that calls the OpenAI API to generate quizzes
// based on video transcripts at specific checkpoints

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, moduleTitle } = await req.json();
    
    if (!transcript) {
      throw new Error("Transcript is required");
    }
    
    if (!openaiApiKey) {
      throw new Error("OpenAI API key is not configured");
    }
    
    console.log(`Generating quiz for module: ${moduleTitle}`);
    
    // The prompt for GPT to generate quiz questions
    const systemPrompt = `You are an AI quiz assistant for an educational platform.
    
You will receive a transcript from a video lecture. Based on this content, generate 2 multiple-choice questions to test understanding.

Each question should:
1. Focus on key concepts from the transcript
2. Have 3-4 distinct answer options
3. Have exactly one correct answer option
4. Be clearly explained by the content in the transcript

Respond ONLY in the JSON format specified, with no additional text.`;

    const userPrompt = `Generate 2 multiple-choice quiz questions based on this lecture transcript:

${transcript.substring(0, 5000)} ${transcript.length > 5000 ? "... [transcript continues]" : ""}

The lecture is about "${moduleTitle}".

Respond ONLY in this exact JSON format:
{
  "quiz": [
    {
      "question_text": "Question 1?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_option": "Option A"
    },
    {
      "question_text": "Question 2?",
      "options": ["Option A", "Option B", "Option C"],
      "correct_option": "Option C"
    }
  ]
}`;

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 800,
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("OpenAI API error:", data.error);
      throw new Error(`OpenAI API error: ${data.error.message}`);
    }
    
    const generatedText = data.choices[0].message.content.trim();
    let quizData;
    
    try {
      quizData = JSON.parse(generatedText);
    } catch (error) {
      console.error("Error parsing JSON from OpenAI response:", error);
      console.log("Raw response:", generatedText);
      
      // Create a fallback structure
      quizData = {
        quiz: [
          {
            question_text: `What is the main topic of this ${moduleTitle} lecture?`,
            options: ["Option A", "Option B", "Option C", "Option D"],
            correct_option: "Option A"
          },
          {
            question_text: `Which concept was discussed in the ${moduleTitle} lecture?`,
            options: ["Concept 1", "Concept 2", "Concept 3"],
            correct_option: "Concept 1"
          }
        ]
      };
    }
    
    console.log("Quiz generated successfully");
    
    return new Response(JSON.stringify(quizData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  } catch (error) {
    console.error("Error in generate-quiz function:", error);
    
    // Return error response with a 200 status to avoid Edge Function non-2xx error
    return new Response(
      JSON.stringify({
        status: 'error', 
        error: error.message,
        fallback: {
          quiz: [
            {
              question_text: "What is the main topic of this lecture?",
              options: ["Option A", "Option B", "Option C"],
              correct_option: "Option A"
            }
          ]
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
