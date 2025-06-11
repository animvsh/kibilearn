import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { pdfText, fileName } = await req.json();
    
    if (!pdfText) {
      return new Response(
        JSON.stringify({ error: 'No PDF text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Received request for PDF processing");
    console.log("PDF text sample:", pdfText.substring(0, 200));
    
    // Check if the input text is the "limited text extraction" message
    if (pdfText.includes("Limited text extraction available")) {
      console.log("Limited extraction detected, returning fallback content");
      return new Response(
        JSON.stringify({
          title: "Document Analysis",
          warning: "Limited text content available for analysis",
          modules: generateFallbackModules("Document Analysis")
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check for binary data in the text
    if (containsBinaryData(pdfText)) {
      console.log("Binary data detected in PDF text, using fallback content");
      return new Response(
        JSON.stringify({
          title: fileName ? fileName.replace('.pdf', '') : 'Document Analysis',
          warning: "PDF text contained binary data that could not be processed properly",
          modules: generateFallbackModules(fileName ? fileName.replace('.pdf', '') : 'Document')
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check text quality
    const textQualityIssues = checkTextQuality(pdfText);
    
    if (textQualityIssues) {
      console.log("Quality issues detected in PDF text:", textQualityIssues);
      return new Response(
        JSON.stringify({ 
          warning: textQualityIssues,
          title: fileName ? fileName.replace('.pdf', '') : 'Document Analysis',
          modules: generateModulesFromText(pdfText, fileName) // Still try to generate modules
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate course content from the text
    const courseContent = await generateCourseFromText(pdfText, fileName);
    
    return new Response(
      JSON.stringify(courseContent),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('PDF processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process PDF: ' + error.message,
        title: 'Document Analysis',
        modules: generateFallbackModules('Document')
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Check for binary data in the text
 */
function containsBinaryData(text: string): boolean {
  // Check for patterns that indicate binary data
  const binaryPatterns = [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]{10,}/g, // Control characters sequence
    /�{5,}/g, // Multiple replacement characters
    /[^\x20-\x7E\n\r\t\x09\x0A\x0D\u00A0-\uFFFF]{20,}/g // Non-printable sequences
  ];
  
  for (const pattern of binaryPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // If over 20% of text contains unusual characters, consider it binary
  let unusualCharCount = 0;
  for (let i = 0; i < Math.min(text.length, 1000); i++) {
    const charCode = text.charCodeAt(i);
    if ((charCode < 32 && ![9, 10, 13].includes(charCode)) || 
        (charCode > 126 && charCode < 160)) {
      unusualCharCount++;
    }
  }
  
  const sampleLength = Math.min(text.length, 1000);
  return (unusualCharCount / sampleLength) > 0.2;
}

/**
 * Check for quality issues in the extracted text
 */
function checkTextQuality(text: string): string | null {
  // Check for very short text
  if (text.length < 200) {
    return "The extracted text is too short for meaningful analysis.";
  }
  
  // Check for PDF binary content
  if (hasPdfBinaryMarkers(text)) {
    return "The extracted text appears to contain PDF binary data rather than readable content.";
  }
  
  // Check for repetitive patterns that indicate extraction issues
  if (hasRepetitivePatterns(text)) {
    return "The extracted text contains repetitive patterns that may indicate extraction issues.";
  }
  
  return null; // No issues detected
}

/**
 * Check for PDF binary markers in text
 */
function hasPdfBinaryMarkers(text: string): boolean {
  // Common PDF binary markers
  const binaryMarkers = [
    'endstream', 'endobj', 'xref', 'trailer', '65535 f', '00000 n',
    '%PDF-', 'obj', 'stream'
  ];
  
  // Count how many markers are found
  let markerCount = 0;
  for (const marker of binaryMarkers) {
    if (text.includes(marker)) {
      markerCount++;
    }
  }
  
  // If multiple markers are found, it's likely binary data
  return markerCount >= 3;
}

/**
 * Check for repetitive patterns that indicate extraction issues
 */
function hasRepetitivePatterns(text: string): boolean {
  // Look for the same sentence repeating multiple times
  const lines = text.split('\n');
  const lineSet = new Set(lines);
  
  // If there are significantly fewer unique lines than total lines, we have repetition
  return lines.length > 20 && lineSet.size < lines.length * 0.5;
}

/**
 * Generate course content from extracted PDF text
 */
async function generateCourseFromText(text: string, documentName: string): Promise<any> {
  // Get OpenAI API key from environment
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    console.log("OpenAI API key not configured, using fallback generation");
    return {
      title: documentName ? documentName.replace('.pdf', '') : 'Document Analysis',
      description: `Analysis of ${documentName || 'uploaded document'}`,
      modules: generateModulesFromText(text, documentName)
    };
  }
  
  try {
    console.log("Calling OpenAI to generate course content");
    
    // Clean and prepare the text
    let cleanedText = text;
    
    // If the text is too long, truncate it to respect OpenAI's token limits
    // and keep the first and last parts which usually have the most important information
    if (cleanedText.length > 15000) {
      const firstPart = cleanedText.substring(0, 7500);
      const lastPart = cleanedText.substring(cleanedText.length - 7500);
      cleanedText = firstPart + "\n\n[...content truncated...]\n\n" + lastPart;
    }
    
    // Attempt to extract title from the text
    const potentialTitle = extractPotentialTitle(cleanedText);
    const titleToUse = potentialTitle || (documentName ? documentName.replace('.pdf', '') : 'Document Analysis');
    
    // Call OpenAI API to generate course content
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using a more capable but still efficient model
        messages: [
          {
            role: 'system',
            content: `You are an expert educational content creator that transforms document text into well-structured learning modules. 
            Create a cohesive course with 4-6 modules, each with a clear title, description, and content.
            Focus on the most important concepts from the text and organize them logically.
            For each module, include key learning points and explanations.
            If the text appears to be code or technical content, include relevant code examples in the modules.
            Even if the text is limited, make the best possible course structure based on available information.`
          },
          {
            role: 'user',
            content: `Create a comprehensive course outline from this document text. The document is titled "${titleToUse}".
            
            Here's the text:
            
            ${cleanedText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid response from OpenAI", data);
      throw new Error('Invalid response from OpenAI');
    }
    
    const generatedContent = data.choices[0].message.content;
    console.log("Successfully generated course content from OpenAI");
    
    // Parse the generated content into course structure
    return parseGeneratedContentToCourse(generatedContent, titleToUse);
    
  } catch (error) {
    console.error('Error generating course content:', error);
    
    // Fallback to basic generation
    return {
      title: documentName ? documentName.replace('.pdf', '') : 'Document Analysis',
      description: `Analysis of ${documentName || 'uploaded document'}`,
      modules: generateModulesFromText(text, documentName)
    };
  }
}

/**
 * Try to extract a title from the document text
 */
function extractPotentialTitle(text: string): string | null {
  // First, try to find a title marked in the text
  const titleLine = text.split('\n').find(line => 
    line.toLowerCase().includes('title:') || 
    /^#\s+.+/.test(line) ||
    /^Title\s*[-:]\s*.+/i.test(line)
  );
  
  if (titleLine) {
    // Extract title, removing any markdown or prefixes
    return titleLine
      .replace(/^#\s+/, '')          // Remove markdown heading
      .replace(/^Title\s*[-:]\s*/i, '') // Remove "Title:" prefix
      .trim();
  }
  
  // If no explicit title found, look at the first few lines
  const firstLines = text.split('\n').slice(0, 5);
  
  // Look for a short line (likely a title) at the beginning
  const shortLine = firstLines.find(line => {
    const trimmed = line.trim();
    return trimmed.length > 10 && trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.includes(':');
  });
  
  return shortLine ? shortLine.trim() : null;
}

/**
 * Parse GPT-generated content into course structure
 */
function parseGeneratedContentToCourse(content: string, documentName: string): any {
  try {
    // Initialize the course object with reasonable defaults
    const course = {
      title: documentName,
      description: 'Generated from document content',
      modules: []
    };
    
    // Try to extract a better title and description
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^Title:?\s+(.+)$/mi);
    if (titleMatch) {
      course.title = titleMatch[1].trim();
    }
    
    const descMatch = content.match(/^Description:?\s+(.+)$/mi) || 
                      content.match(/^Overview:?\s+(.+)$/mi) ||
                      content.match(/\n\n(.+?)\n\n/);
    if (descMatch) {
      course.description = descMatch[1].trim();
    }
    
    // Look for module patterns in different formats
    let moduleMatches = content.match(/(?:^|\n)(?:Module|Chapter|Section|Unit) \d+[\.:]\s*.*?(?=(?:\n(?:Module|Chapter|Section|Unit) \d+[\.:]\s*)|$)/gs);
    
    // If we don't find modules in that format, try a simpler pattern
    if (!moduleMatches || moduleMatches.length < 2) {
      moduleMatches = content.match(/(?:^|\n)## .*?(?=(?:\n## )|$)/gs);
    }
    
    if (moduleMatches && moduleMatches.length > 0) {
      // Process each module
      course.modules = moduleMatches.map((moduleText, index) => {
        // Extract module title
        const titleMatch = moduleText.match(/(?:Module|Chapter|Section|Unit) \d+[\.:]\s*(.*?)(?:\n|$)/) || 
                          moduleText.match(/## (.*?)(?:\n|$)/);
        const title = titleMatch ? titleMatch[1].trim() : `Module ${index + 1}`;
        
        // Extract module description
        let description = '';
        const descLines = moduleText.split('\n').slice(1).join('\n');
        const descMatch = descLines.match(/^(?!#)(.+?)(?:\n\n|\n#)/s);
        if (descMatch) {
          description = descMatch[1].trim();
        }
        
        // Extract content
        const conceptContent = moduleText.split('\n').slice(1).join('\n');
        
        // Create code content - check if this might be a coding topic
        const isCodeTopic = moduleText.toLowerCase().includes('code') || 
                           moduleText.toLowerCase().includes('programming') ||
                           moduleText.toLowerCase().includes('function') ||
                           moduleText.toLowerCase().includes('algorithm');
                           
        const codeContent = {
          explanation: isCodeTopic ? 'Practice implementing the concepts from this module' : 'Apply what you\'ve learned',
          snippet: isCodeTopic ? '// Add your implementation here' : '// Add your notes here',
          language: 'javascript'
        };
        
        return {
          title: title,
          description: description || `Learn about ${title}`,
          content: {
            conceptContent,
            codeContent,
            videoIds: []
          }
        };
      });
    } else {
      // If we can't find explicit modules, try to create them from content sections
      course.modules = createModulesFromContent(content);
    }
    
    // Ensure we have at least one module
    if (course.modules.length === 0) {
      course.modules = generateFallbackModules(course.title);
    }
    
    // Limit to a reasonable number of modules
    if (course.modules.length > 8) {
      course.modules = course.modules.slice(0, 8);
    }
    
    return course;
  } catch (error) {
    console.error('Error parsing generated content:', error);
    return {
      title: documentName,
      description: 'Generated from document content',
      modules: generateFallbackModules(documentName)
    };
  }
}

/**
 * Create modules from content if no explicit module structure is found
 */
function createModulesFromContent(content: string): any[] {
  // Split content by headers, sections, or natural breaks
  const sections = content.split(/\n#{1,3} /).filter(Boolean);
  
  if (sections.length <= 1) {
    // Try splitting by numbered sections
    const numberedSections = content.split(/\n\d+\. /).filter(Boolean);
    if (numberedSections.length > 1) {
      return numberedSections.slice(0, 6).map((section, index) => createModuleFromSection(section, index));
    }
    
    // Try splitting by empty lines as a last resort
    const paragraphs = content.split(/\n\s*\n/).filter(s => s.trim().length > 0);
    if (paragraphs.length >= 3) {
      return groupParagraphsIntoModules(paragraphs);
    }
    
    // If all else fails, just use the content as a single module
    return [{
      title: 'Main Content',
      description: 'Content from the document',
      content: {
        conceptContent: content,
        codeContent: {
          explanation: 'Practice what you\'ve learned',
          snippet: '// Add your notes here',
          language: 'javascript'
        },
        videoIds: []
      }
    }];
  }
  
  // Process each section as a module
  return sections.slice(0, 6).map((section, index) => createModuleFromSection(section, index));
}

/**
 * Create a module from a content section
 */
function createModuleFromSection(section: string, index: number): any {
  const lines = section.trim().split('\n');
  const title = lines[0].replace(/^#+\s*/, '').trim() || `Section ${index + 1}`;
  
  // Extract description from first paragraph if possible
  let description = '';
  if (lines.length > 1) {
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      if (lines[i].trim().length > 0) {
        description = lines[i].trim();
        break;
      }
    }
  }
  
  if (!description && lines.length > 0) {
    description = `Content related to ${title}`;
  }
  
  return {
    title,
    description: description.length > 150 ? description.substring(0, 150) + '...' : description,
    content: {
      conceptContent: section,
      codeContent: {
        explanation: 'Practice what you\'ve learned',
        snippet: '// Add your notes here',
        language: 'javascript'
      },
      videoIds: []
    }
  };
}

/**
 * Group paragraphs into modules
 */
function groupParagraphsIntoModules(paragraphs: string[]): any[] {
  const moduleCount = Math.min(Math.ceil(paragraphs.length / 2), 6); // 2-6 paragraphs per module
  const modules = [];
  
  for (let i = 0; i < moduleCount; i++) {
    const startIdx = Math.floor(i * paragraphs.length / moduleCount);
    const endIdx = Math.floor((i + 1) * paragraphs.length / moduleCount);
    const moduleParagraphs = paragraphs.slice(startIdx, endIdx);
    
    // Try to create a meaningful title from the first paragraph
    const firstPara = moduleParagraphs[0].trim();
    let title = firstPara;
    
    // If the paragraph is too long, extract the first sentence or significant phrase
    if (title.length > 60) {
      const firstSentence = title.split(/[.!?]/, 1)[0];
      if (firstSentence && firstSentence.length > 10 && firstSentence.length < 80) {
        title = firstSentence;
      } else {
        // Fall back to first 40 characters
        title = title.substring(0, 40) + "...";
      }
    }
    
    modules.push({
      title: `${i + 1}. ${title}`,
      description: moduleParagraphs[0].substring(0, 150) + (moduleParagraphs[0].length > 150 ? '...' : ''),
      content: {
        conceptContent: moduleParagraphs.join('\n\n'),
        codeContent: {
          explanation: 'Practice what you\'ve learned',
          snippet: '// Add your notes here',
          language: 'javascript'
        },
        videoIds: []
      }
    });
  }
  
  return modules;
}

/**
 * Generate modules directly from text without AI
 */
function generateModulesFromText(text: string, documentName: string | undefined): any[] {
  // Extract some key sentences to use as module content
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 20)
    .filter(s => !s.includes('/') && !s.includes('\\'));

  // If we found enough sentences, create modules from them
  if (sentences.length >= 10) {
    // Group sentences into modules (maximum 6 modules)
    const moduleCount = Math.min(6, Math.ceil(sentences.length / 8));
    const modules = [];
    
    for (let i = 0; i < moduleCount; i++) {
      const startIdx = Math.floor(i * sentences.length / moduleCount);
      const endIdx = Math.floor((i + 1) * sentences.length / moduleCount);
      const moduleSentences = sentences.slice(startIdx, endIdx);
      
      // Use the first sentence as the title basis
      const titleBase = moduleSentences[0].substring(0, 40).trim();
      const title = titleBase.endsWith('.') ? titleBase.slice(0, -1) : titleBase;
      
      modules.push({
        title: `${i + 1}. ${title}${title.endsWith('...') ? '' : '...'}`,
        description: moduleSentences[0].substring(0, 150) + (moduleSentences[0].length > 150 ? '...' : ''),
        content: {
          conceptContent: moduleSentences.join(' '),
          codeContent: {
            explanation: 'Practice what you\'ve learned',
            snippet: '// Add your notes here',
            language: 'javascript'
          },
          videoIds: []
        }
      });
    }
    
    return modules;
  }
  
  // If we don't have enough content, use fallback modules
  return generateFallbackModules(documentName || 'Document');
}

/**
 * Generate fallback modules when content extraction fails
 */
function generateFallbackModules(documentName: string): any[] {
  const title = documentName.replace(/\.[^.]+$/, ''); // Remove file extension if present
  
  return [
    {
      title: `Understanding ${title}`,
      description: `Basic concepts and structure of ${title}`,
      content: {
        conceptContent: `This module introduces you to the fundamental concepts related to ${title}. It covers the basic structure, core principles, and key terminology you'll need to understand the topic.`,
        codeContent: {
          explanation: "Practice document analysis",
          snippet: "// Add your notes here\n\n// Key points:\n// 1.\n// 2.\n// 3.",
          language: "javascript"
        },
        videoIds: []
      }
    },
    {
      title: `${title} Analysis Techniques`,
      description: `Methods for analyzing ${title} content effectively`,
      content: {
        conceptContent: `This module covers various analytical approaches to understanding ${title}. You'll learn how to break down complex information, identify patterns, and extract meaningful insights.`,
        codeContent: {
          explanation: "Practice content analysis",
          snippet: "// Add your analysis here\n\n/* Analysis framework:\n   - Identify main topics\n   - Extract key points\n   - Connect related concepts\n*/",
          language: "javascript"
        },
        videoIds: []
      }
    },
    {
      title: `Practical Applications of ${title}`,
      description: `Real-world applications and implementations`,
      content: {
        conceptContent: `In this module, you'll explore practical ways to apply what you've learned about ${title}. We'll look at real-world scenarios, implementation strategies, and best practices for using this knowledge effectively.`,
        codeContent: {
          explanation: "Practice implementation",
          snippet: "// Example implementation\nfunction apply${title.replace(/\s+/g, '')}Concepts() {\n  // Your code here\n  \n  // Implementation steps:\n  // 1. Research\n  // 2. Plan\n  // 3. Execute\n}",
          language: "javascript"
        },
        videoIds: []
      }
    },
    {
      title: `Advanced Topics in ${title}`,
      description: `Deeper exploration of complex aspects`,
      content: {
        conceptContent: `This module delves into more advanced concepts related to ${title}. Building on the foundation of earlier modules, you'll explore sophisticated techniques, emerging trends, and cutting-edge developments in this field.`,
        codeContent: {
          explanation: "Advanced implementation challenges",
          snippet: "// Advanced implementation\n\n/* Consider these advanced topics:\n   - Optimization strategies\n   - Integration with other systems\n   - Future developments\n*/",
          language: "javascript"
        },
        videoIds: []
      }
    }
  ];
}
