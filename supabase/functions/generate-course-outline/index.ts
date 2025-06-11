
// This file is an Edge Function that calls the OpenAI API to generate a course outline
// It uses the OPENAI_API_KEY secret stored in Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Set up CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the input text from the request
    const { inputText } = await req.json();
    
    if (!inputText || inputText.trim() === "") {
      throw new Error("Input text is required");
    }
    
    // Get the OpenAI API key from environment variables
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key is not configured");
    }
    
    console.log("Calling OpenAI API with input:", inputText.substring(0, 50) + "...");
    
    // Call OpenAI API directly with fetch instead of using the client
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert curriculum designer specializing in creating well-structured educational outlines. Format your response exactly as specified in the user's prompt."
          },
          {
            role: "user",
            content: `Based on this input, generate a course outline that includes:
            - A descriptive and engaging course title
            - A list of 3-5 units (numbered)
            - Each unit should contain 2-3 subunits (just titles)
            
            Return the response in this exact JSON format:
            {
              "title": "Course Title",
              "units": [
                {
                  "title": "Unit Title",
                  "subunits": ["Subunit 1", "Subunit 2", "Subunit 3"]
                }
              ]
            }
            
            Make sure:
            1. The JSON is valid and properly formatted
            2. Each unit has a clear, descriptive title
            3. Subunits are specific and actionable learning topics
            4. The structure follows a logical learning progression
            5. The content is comprehensive and covers all important aspects of the topic
            
            Input text: ${inputText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      })
    });

    // Extract the response and parse the JSON
    const responseData = await response.json();
    
    if (responseData.error) {
      console.error("OpenAI API error:", responseData.error);
      throw new Error(`OpenAI API error: ${responseData.error.message}`);
    }
    
    const generatedText = responseData.choices[0].message.content.trim();
    let outlineData;
    
    try {
      // Try to parse the JSON response
      outlineData = JSON.parse(generatedText);
      
      // Validate the structure of the JSON
      if (!outlineData.title || !Array.isArray(outlineData.units)) {
        throw new Error("Invalid response structure");
      }
      
    } catch (error) {
      console.error("Error parsing JSON from OpenAI response:", error);
      console.log("Raw response:", generatedText);
      throw new Error("Failed to parse the generated outline");
    }
    
    console.log("Generated outline for:", outlineData.title);
    console.log("Number of units:", outlineData.units.length);
    
    // Return the generated outline with a consistent 200 status
    return new Response(JSON.stringify(outlineData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-course-outline function:", error);
    
    // Return error response with a 200 status to avoid Edge Function non-2xx error
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
