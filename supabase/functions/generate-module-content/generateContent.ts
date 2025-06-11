
// Fast content generation with OpenAI-generated module descriptions

import "https://deno.land/x/xhr@0.1.0/mod.ts";

export async function generateContent(req: Request, corsHeaders: Record<string, string>) {
  try {
    const requestData = await req.json();
    const { outline, demoMode } = requestData;

    if (!outline || !outline.title || !outline.units || outline.units.length === 0) {
      throw new Error("Valid course outline is required");
    }

    console.log("Generating module descriptions for:", outline.title);
    console.log("Demo mode:", demoMode ? "enabled" : "disabled");

    // Get unit index from URL parameters
    const unitIndex = req.url.includes('unitIndex=') 
      ? parseInt(new URL(req.url).searchParams.get('unitIndex') || '0') 
      : 0;

    const unit = outline.units[unitIndex];
    if (!unit) {
      return new Response(
        JSON.stringify({ 
          status: "complete", 
          message: "All units processed successfully" 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    }

    console.log(`Processing unit ${unitIndex + 1}/${outline.units.length}: ${unit.title}`);

    // Create structure with OpenAI-generated descriptions
    const unitContent = await createStructureWithDescriptions(unit, unitIndex, outline.title, demoMode);

    const calculatedProgress = Math.round(((unitIndex + 1) / outline.units.length) * 100);

    return new Response(
      JSON.stringify({
        status: "processing",
        unitIndex: unitIndex,
        totalUnits: outline.units.length,
        currentUnit: unitContent,
        progress: calculatedProgress
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("Error in generateContent function:", error);

    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}

// Generate structure with OpenAI-powered module descriptions
async function createStructureWithDescriptions(unit: { title: string; subunits: string[] }, unitIndex: number, courseTitle: string, demoMode: boolean) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  // If demo mode or no API key, use fast placeholder descriptions
  if (demoMode || !openaiApiKey) {
    return createFastStructure(unit, unitIndex);
  }

  try {
    // Generate descriptions for all subunits in one API call for efficiency
    const subunitDescriptions = await generateSubunitDescriptions(unit, courseTitle, openaiApiKey);
    
    return {
      title: unit.title,
      introduction: `This unit covers key concepts in ${unit.title}.`,
      content: unit.subunits.map((subunit: string, subunitIndex: number) => ({
        title: subunit,
        modules: [
          {
            id: `${unitIndex}-${subunitIndex}-0`,
            type: "article",
            title: `Introduction to ${subunit}`,
            description: subunitDescriptions[subunit]?.article || `Learn the fundamental concepts and principles of ${subunit}. This module provides a comprehensive overview of the topic.`,
            placeholder: true
          },
          {
            id: `${unitIndex}-${subunitIndex}-1`,
            type: "lecture",
            title: `${subunit} Explained`,
            description: subunitDescriptions[subunit]?.lecture || `Video lecture covering key topics and demonstrations for ${subunit}. Watch detailed explanations and examples.`,
            placeholder: true
          },
          {
            id: `${unitIndex}-${subunitIndex}-2`,
            type: "quiz",
            title: `${subunit} Knowledge Check`,
            description: subunitDescriptions[subunit]?.quiz || `Test your understanding of ${subunit} concepts with this interactive quiz. Assess your learning progress.`,
            placeholder: true
          },
          {
            id: `${unitIndex}-${subunitIndex}-3`,
            type: "review",
            title: `${subunit} Summary`,
            description: subunitDescriptions[subunit]?.review || `Review and consolidate your learning about ${subunit}. Summary of key points and takeaways.`,
            placeholder: true
          }
        ]
      }))
    };
  } catch (error) {
    console.error("Error generating descriptions with OpenAI, falling back to fast structure:", error);
    return createFastStructure(unit, unitIndex);
  }
}

// Generate descriptions for all subunits in one efficient API call
async function generateSubunitDescriptions(unit: { title: string; subunits: string[] }, courseTitle: string, apiKey: string) {
  const prompt = `Generate brief, engaging module descriptions for a course on "${courseTitle}".

Unit: ${unit.title}
Subunits: ${unit.subunits.join(', ')}

For each subunit, create 4 module descriptions (1-2 sentences each) for:
1. Article module (introduction/concepts)
2. Lecture module (video explanation)  
3. Quiz module (knowledge assessment)
4. Review module (summary/consolidation)

Format as JSON:
{
  "subunit_name": {
    "article": "description",
    "lecture": "description", 
    "quiz": "description",
    "review": "description"
  }
}

Keep descriptions concise, specific, and educational.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an educational content expert. Generate concise, engaging module descriptions that clearly explain what students will learn.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content received from OpenAI");
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", content);
    throw new Error("Invalid JSON response from OpenAI");
  }
}

// Fast structure creation without API calls (fallback)
function createFastStructure(unit: { title: string; subunits: string[] }, unitIndex: number) {
  return {
    title: unit.title,
    introduction: `This unit covers key concepts in ${unit.title}.`,
    content: unit.subunits.map((subunit: string, subunitIndex: number) => ({
      title: subunit,
      modules: [
        {
          id: `${unitIndex}-${subunitIndex}-0`,
          type: "article",
          title: `Introduction to ${subunit}`,
          description: `Learn the fundamental concepts and principles of ${subunit}. This module provides a comprehensive overview of the topic.`,
          placeholder: true
        },
        {
          id: `${unitIndex}-${subunitIndex}-1`,
          type: "lecture",
          title: `${subunit} Explained`,
          description: `Video lecture covering key topics and demonstrations for ${subunit}. Watch detailed explanations and examples.`,
          placeholder: true
        },
        {
          id: `${unitIndex}-${subunitIndex}-2`,
          type: "quiz",
          title: `${subunit} Knowledge Check`,
          description: `Test your understanding of ${subunit} concepts with this interactive quiz. Assess your learning progress.`,
          placeholder: true
        },
        {
          id: `${unitIndex}-${subunitIndex}-3`,
          type: "review",
          title: `${subunit} Summary`,
          description: `Review and consolidate your learning about ${subunit}. Summary of key points and takeaways.`,
          placeholder: true
        }
      ]
    }))
  };
}
