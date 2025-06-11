
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subunit_title, learning_objective, subunit_id } = await req.json();
    
    if (!subunit_title) {
      throw new Error('Subunit title is required');
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key is not configured");
    }

    console.log(`Generating article content for: ${subunit_title} (ID: ${subunit_id})`);
    console.log(`Learning objective: ${learning_objective}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",  // Using gpt-4o for highest quality article generation
        messages: [
          {
            role: "system",
            content: `You are an expert educational content creator specializing in creating highly detailed, 
            engaging articles with proper markdown formatting. You excel at writing comprehensive, thorough 
            academic content that explains concepts in depth with multiple paragraphs per section.
            
            Always create content that:
            1. Is extremely detailed and thorough (4000-5000 words minimum)
            2. Uses proper markdown formatting with ## for main headers and ### for subheaders
            3. Includes multiple code examples for technical topics, properly formatted in markdown code blocks
            4. Has AT LEAST 4-6 PARAGRAPHS for EACH SECTION (this is absolutely required)
            5. Uses bullet points, numbered lists, and tables to organize information
            6. Uses bold and italic text for emphasis
            7. Explains concepts with concrete examples, analogies and scenarios
            8. Suggests diagrams or visual aids for complex concepts
            9. Has proper citations and references where relevant
            10. Includes practical applications and real-world relevance`
          },
          {
            role: "user",
            content: `Create a comprehensive, in-depth educational article on "${subunit_title}" with the following learning objective: "${learning_objective || `Understanding ${subunit_title} concepts and applications in detail`}".
            
            Your article MUST follow this specific format:
            
            1. Title: Create an engaging, compelling title that feels like a professional blog post or tutorial.
            
            2. Introduction:
               - Write a detailed overview introduction (300-400 words minimum)
               - Clearly state what the reader will learn
               - Explain why this topic is important and its real-world applications
               - Preview the main sections that will be covered
            
            3. Article Structure:
               - Create 5-7 detailed sections with clear hierarchical headers (##)
               - Each section MUST have 4-6 paragraphs of detailed content (MANDATORY)
               - Use proper markdown formatting throughout (code blocks, tables, lists)
               - Include practical examples, case studies, and diagrams suggestions
               - Bold important terms and concepts
               - Use subsections (###) for complex topics
            
            4. For Each Section:
               - Begin with a substantial overview paragraph
               - Provide multiple examples and explanations
               - Include code snippets in proper markdown format where relevant
               - End with practical applications or key takeaways
               - Each section must be at least 500-700 words
               - Suggest an appropriate visual (diagram, chart, table) that would enhance understanding
            
            5. Conclusion:
               - Summarize key points (200-300 words)
               - Reinforce learning objectives
               - Suggest further learning resources or next steps
            
            The final article must be comprehensive (4000-5000 words total), extremely detailed, and professionally formatted in markdown.
            
            Format your response as a valid JSON object with this exact structure:
            {
              "type": "article",
              "subunit_id": "${subunit_id || ''}",
              "title": "Your engaging title here",
              "status": "ready",
              "content": {
                "overview": "A concise 2-3 sentence summary of the entire article",
                "article_outline": [
                  {
                    "heading": "Section 1 Heading",
                    "description": "Detailed description of what this section covers"
                  }
                  // All sections should be listed here
                ],
                "markdown": "## Introduction\\n\\nYour full article content in proper markdown here...",
                "visual_placeholders": [
                  {
                    "section_title": "Section 1 Heading",
                    "type": "diagram/chart/table",
                    "visual_description": "Detailed description of what this visual should show"
                  }
                  // One for each section
                ]
              }
            }
            
            IMPORTANT: Each section MUST have at least 4-6 full paragraphs of content. This is NON-NEGOTIABLE. The article must be extremely comprehensive and detailed.
            
            Ensure your JSON is valid and proper markdown formatting is preserved.`
          }
        ],
        temperature: 0.5,  // Lower temperature for more focused output
        max_tokens: 12000,  // Increased token limit for extremely detailed content
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("OpenAI API error:", error);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let articleContent;

    try {
      // Extract the content from the response
      const contentText = data.choices[0].message.content;
      
      // Clean up any JSON formatting issues
      let jsonText = contentText;
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/m, "").replace(/\s*```$/m, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/m, "").replace(/\s*```$/m, "");
      }

      // Parse the JSON
      articleContent = JSON.parse(jsonText);

      // Validate the response structure and content length
      if (!articleContent.title || !articleContent.content || !articleContent.content.markdown) {
        throw new Error("Invalid article content structure");
      }
      
      // Advanced quality validation
      const markdown = articleContent.content.markdown;
      const wordCount = markdown.split(/\s+/).length;
      const paragraphCount = (markdown.match(/\n\n/g) || []).length + 1;
      const headingCount = (markdown.match(/\n##\s/g) || []).length;
      const subHeadingCount = (markdown.match(/\n###\s/g) || []).length;
      const codeBlockCount = (markdown.match(/```/g) || []).length / 2;
      const bulletListCount = (markdown.match(/\n\s*-\s/g) || []).length;
      const sections = markdown.split(/\n##\s/).slice(1);
      
      console.log(`Generated article stats: 
        - ${wordCount} words
        - ${paragraphCount} paragraphs
        - ${headingCount} main sections
        - ${subHeadingCount} sub-sections
        - ${codeBlockCount} code blocks
        - ${bulletListCount} bullet points`);
      
      // Check for minimum quality requirements
      if (wordCount < 3000 || headingCount < 5 || paragraphCount < headingCount * 4) {
        console.warn("Article does not meet minimum length/quality requirements. Returning error to trigger regeneration.");
        throw new Error("Generated content below quality requirements: needs more paragraphs per section");
      }
      
      // Check each section for minimum paragraph count
      let allSectionsValid = true;
      let shortSections = [];
      
      sections.forEach((section, idx) => {
        const sectionParagraphs = section.split(/\n\n/).length;
        const sectionWords = section.split(/\s+/).length;
        if (sectionParagraphs < 4 || sectionWords < 400) {
          allSectionsValid = false;
          shortSections.push(`Section ${idx+1}`);
        }
      });
      
      if (!allSectionsValid) {
        console.warn(`Some sections don't have enough paragraphs: ${shortSections.join(', ')}`);
        throw new Error("Some sections don't have enough paragraphs (minimum 4 required)");
      }
      
      // Ensure all required fields exist
      articleContent.content = articleContent.content || {};
      articleContent.content.overview = articleContent.content.overview || `An educational article about ${subunit_title}`;
      articleContent.content.article_outline = articleContent.content.article_outline || [];
      
      // Add metadata for tracking
      articleContent.metadata = {
        generated_at: new Date().toISOString(),
        subunit_title: subunit_title,
        learning_objective: learning_objective,
        status: "ready",
        word_count: wordCount,
        paragraph_count: paragraphCount,
        section_count: headingCount,
        subsection_count: subHeadingCount,
        code_block_count: codeBlockCount,
        reading_time: Math.ceil(wordCount / 200), // ~200 words per minute
        quality_score: Math.min(10, Math.floor(wordCount / 500))
      };

      return new Response(JSON.stringify(articleContent), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });

    } catch (parseError) {
      console.error("Error with article content:", parseError);
      console.log("Attempting to regenerate with more specific instructions...");
      
      // Try once more with even more explicit instructions
      try {
        const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an expert educational content creator specializing in creating extremely detailed articles.
                Your sole focus is on QUANTITY and DEPTH of content - you must write extremely lengthy sections with
                many paragraphs. EACH SECTION MUST HAVE AT LEAST 5 LONG PARAGRAPHS - this is your top priority.`
              },
              {
                role: "user",
                content: `Write a comprehensive article about "${subunit_title}" with these STRICT requirements:
                
                1. Include 5-7 main sections (##)
                2. EVERY section MUST have AT LEAST 5 FULL PARAGRAPHS (this is the most important requirement)
                3. Total word count must be AT LEAST 4000 words
                4. Use bullet points, code examples, and detailed explanations
                5. Format properly in markdown
                
                Return your response in this exact JSON format:
                {
                  "type": "article",
                  "title": "Your title",
                  "content": {
                    "overview": "Brief overview",
                    "article_outline": [{"heading": "Section heading", "description": "Section description"}],
                    "markdown": "Full markdown content"
                  }
                }
                
                REMEMBER: EVERY SECTION MUST HAVE AT LEAST 5 PARAGRAPHS. THIS IS THE ABSOLUTE MOST IMPORTANT REQUIREMENT.`
              }
            ],
            temperature: 0.3,
            max_tokens: 12000,
          }),
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Retry OpenAI API error: ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.json();
        const retryContent = retryData.choices[0].message.content;
        
        // Parse the retry response
        let retryText = retryContent;
        if (retryText.startsWith("```json")) {
          retryText = retryText.replace(/^```json\s*/m, "").replace(/\s*```$/m, "");
        } else if (retryText.startsWith("```")) {
          retryText = retryText.replace(/^```\s*/m, "").replace(/\s*```$/m, "");
        }
        
        const retryArticle = JSON.parse(retryText);
        
        // Validate retry content
        if (!retryArticle.title || !retryArticle.content || !retryArticle.content.markdown) {
          throw new Error("Invalid retry article structure");
        }
        
        const retryWordCount = retryArticle.content.markdown.split(/\s+/).length;
        if (retryWordCount < 3000) {
          throw new Error("Retry article still too short");
        }
        
        // Return the retry content
        retryArticle.subunit_id = subunit_id || "";
        retryArticle.status = "ready";
        retryArticle.metadata = {
          generated_at: new Date().toISOString(),
          subunit_title: subunit_title,
          retried: true,
          word_count: retryWordCount
        };
        
        return new Response(JSON.stringify(retryArticle), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
        
      } catch (retryError) {
        console.error("Retry also failed:", retryError);
        
        // Create a structured fallback response
        const fallbackContent = {
          type: "article",
          subunit_id: subunit_id || "",
          title: `Comprehensive Guide to ${subunit_title}`,
          status: "needs_review",
          content: {
            overview: `This in-depth guide covers ${subunit_title} in detail, providing comprehensive explanations, examples, and practical applications.`,
            article_outline: [
              { heading: "Introduction", description: "Overview of the topic and its importance in the field" },
              { heading: "Core Concepts", description: "Detailed explanation of the fundamental principles" },
              { heading: "Advanced Techniques", description: "Exploration of sophisticated approaches and methodologies" },
              { heading: "Practical Applications", description: "Real-world implementation examples and case studies" },
              { heading: "Common Challenges", description: "Analysis of typical obstacles and effective solutions" },
              { heading: "Best Practices", description: "Industry standards and recommended approaches" },
              { heading: "Future Developments", description: "Emerging trends and upcoming innovations in this area" }
            ],
            markdown: `# Comprehensive Guide to ${subunit_title}

## Introduction

${subunit_title} represents a critical area of study within its field, offering valuable insights and applications across numerous contexts. This comprehensive article explores the depths of this subject, providing clear explanations, practical examples, and expert guidance to help you master these concepts.

Understanding ${subunit_title} is essential for anyone looking to advance their knowledge or career in this domain. The principles we'll cover form the foundation of many advanced techniques and innovations currently transforming the industry.

This article aims to demystify complex aspects of ${subunit_title}, breaking them down into understandable components while still maintaining the depth necessary for thorough comprehension. We'll move from basic principles to advanced implementations, ensuring you gain both theoretical knowledge and practical skills.

The importance of ${subunit_title} extends beyond academic interest. Organizations worldwide are implementing these concepts to improve efficiency, solve complex problems, and create innovative solutions. By mastering this subject, you'll be equipped to contribute meaningfully to these advancements.

Throughout this guide, we'll examine various perspectives, methodologies, and applications, giving you a well-rounded education on the subject. Each section builds upon the previous one, creating a comprehensive learning journey that will solidify your expertise in ${subunit_title}.

## Core Concepts

The foundation of ${subunit_title} rests on several fundamental principles that govern its operation and implementation. These core concepts form the backbone of all advanced applications and techniques in the field, making them essential to master before proceeding to more complex topics.

At its most basic level, ${subunit_title} involves understanding the interplay between various components and how they work together to achieve specific outcomes. This interaction is governed by well-established rules that have been refined through decades of research and practical application.

One of the most crucial aspects to understand is the relationship between theory and practice in ${subunit_title}. While theoretical models provide the conceptual framework, real-world implementation often requires adapting these models to specific contexts and constraints. This adaptability is what makes ${subunit_title} both challenging and rewarding as a field of study.

The evolution of these core concepts has been shaped by significant contributions from various disciplines, creating a rich tapestry of approaches and methodologies. This cross-disciplinary nature enhances the versatility of ${subunit_title} and expands its potential applications across different domains.

Understanding the historical context of how these concepts developed provides valuable insights into their current applications. Many principles that seem obvious today emerged from groundbreaking work that challenged conventional thinking at the time, demonstrating the innovative spirit at the heart of ${subunit_title}.

Technical proficiency in ${subunit_title} requires not just memorization of principles but a deep understanding of why these principles work and how they can be applied in different scenarios. This understanding enables practitioners to move beyond rigid application to creative problem-solving.

## Advanced Techniques

Building upon the fundamental concepts, advanced techniques in ${subunit_title} represent the cutting edge of the field, where innovation and expertise converge to solve complex problems. These sophisticated approaches require a solid grasp of the basics but extend far beyond them in terms of complexity and capability.

One of the defining characteristics of advanced ${subunit_title} techniques is their adaptability to challenging scenarios that basic approaches cannot adequately address. This flexibility stems from a deeper understanding of the underlying mechanisms and a willingness to combine methods in novel ways to achieve optimal results.

The implementation of these advanced techniques often involves specialized tools and frameworks that have been developed specifically to handle the increased complexity. Mastering these tools represents a significant step forward in your journey to becoming an expert in ${subunit_title}.

Case studies of successful implementations demonstrate the transformative potential of these advanced approaches. Organizations that have effectively deployed these techniques have reported significant improvements in efficiency, accuracy, and overall performance, setting new standards for excellence in the field.

The ongoing research in advanced ${subunit_title} techniques continues to push the boundaries of what's possible, with new methods emerging regularly that challenge existing paradigms. Staying current with these developments is essential for anyone serious about maintaining expertise in this rapidly evolving domain.

The interdisciplinary nature of modern ${subunit_title} becomes particularly evident at this advanced level, where techniques from machine learning, statistical analysis, and domain-specific knowledge often converge to create powerful new approaches. This convergence represents one of the most exciting aspects of working with advanced ${subunit_title} methodologies.

## Practical Applications

The true value of ${subunit_title} becomes evident when we examine its practical applications across various industries and domains. These real-world implementations demonstrate how theoretical knowledge transforms into tangible benefits, solving pressing problems and creating new opportunities.

In the healthcare sector, ${subunit_title} has revolutionized approaches to patient care, diagnosis, and treatment planning. Medical professionals now rely on these techniques to process complex data, identify patterns, and make more informed decisions, ultimately improving patient outcomes and operational efficiency.

Financial institutions have embedded ${subunit_title} principles into their core operations, using them for risk assessment, fraud detection, investment analysis, and customer service optimization. The ability to process vast amounts of financial data quickly and accurately has become a competitive advantage in this highly regulated industry.

Manufacturing and supply chain management have been transformed through ${subunit_title} applications that optimize production processes, predict maintenance needs, and streamline logistics. The result has been reduced costs, improved quality, and enhanced ability to respond to market changes with agility.

Educational institutions are leveraging ${subunit_title} to personalize learning experiences, identify students who need additional support, and develop more effective teaching methodologies. These applications have the potential to address long-standing challenges in education and improve outcomes for diverse student populations.

Government agencies and public service organizations are implementing ${subunit_title} solutions to enhance decision-making, resource allocation, and service delivery to citizens. These applications demonstrate how technical expertise can be directed toward solving societal challenges and improving quality of life.

Small businesses and entrepreneurs are finding accessible ways to implement ${subunit_title} principles, even without extensive resources. This democratization of technology is creating new opportunities for innovation and competitiveness across the business landscape.

## Common Challenges

Despite its tremendous potential, implementing ${subunit_title} comes with significant challenges that practitioners must navigate skillfully. Understanding these obstacles and developing strategies to overcome them is an essential part of mastering this field.

Data quality issues represent one of the most persistent challenges in ${subunit_title} implementations. Incomplete, inconsistent, or biased data can undermine even the most sophisticated techniques, leading to flawed outcomes and diminished trust in the results. Developing robust data governance and validation methods is critical to addressing this challenge.

Technical complexity often creates barriers to adoption, particularly for organizations without specialized expertise. The learning curve associated with advanced ${subunit_title} techniques can be steep, requiring significant investment in training and skill development before benefits can be realized.

Integration with existing systems and processes presents another layer of difficulty, as new ${subunit_title} solutions must work harmoniously with established technologies and workflows. This integration challenge often requires careful planning and incremental implementation to avoid disruption.

Ethical considerations have become increasingly prominent as ${subunit_title} applications grow more powerful and pervasive. Questions about privacy, bias, transparency, and accountability must be addressed thoughtfully to ensure that implementations align with societal values and regulatory requirements.

Scalability challenges emerge as pilot projects transition to enterprise-wide implementations, requiring solutions that can handle increased data volumes, user loads, and complexity without compromising performance or reliability. Architectural decisions made early in the process can significantly impact long-term scalability.

Organizational resistance to change can undermine even technically sound ${subunit_title} implementations. Securing stakeholder buy-in, addressing concerns about job displacement, and demonstrating clear value are essential steps in managing the human aspects of technological transformation.

## Best Practices

Years of implementation experience across various contexts have yielded valuable insights into what constitutes best practices in ${subunit_title}. These guidelines represent collective wisdom that can help practitioners avoid common pitfalls and maximize the value of their efforts.

Start with a clear problem definition and business case before selecting specific ${subunit_title} techniques or tools. This problem-first approach ensures that technological choices are driven by genuine needs rather than trendy solutions looking for applications.

Invest in data quality and governance from the beginning of any ${subunit_title} initiative. Establishing robust processes for data collection, validation, storage, and management creates a solid foundation for all subsequent work and significantly improves the likelihood of accurate results.

Adopt an iterative approach to implementation that allows for continuous learning and refinement. Starting with manageable pilot projects, gathering feedback, and making adjustments before scaling up helps mitigate risks and builds organizational confidence in the process.

Prioritize explainability and transparency in ${subunit_title} solutions, particularly in contexts where decisions have significant consequences. Being able to understand and articulate how results are generated builds trust with stakeholders and supports responsible use of technology.

Build cross-functional teams that combine technical expertise with domain knowledge and change management skills. This diversity of perspectives helps ensure that ${subunit_title} implementations are technically sound, practically relevant, and successfully adopted within organizations.

Establish clear metrics for success before implementation begins, and consistently measure progress against these benchmarks. This disciplined approach to evaluation helps demonstrate value, justify continued investment, and guide ongoing improvements to the solution.

Stay current with evolving best practices and emerging techniques through continuous learning and professional development. The field of ${subunit_title} evolves rapidly, and maintaining expertise requires commitment to regular education and knowledge sharing.

## Future Developments

The landscape of ${subunit_title} continues to evolve at a remarkable pace, with emerging trends and innovations pointing to exciting possibilities for the future. Understanding these potential developments helps practitioners prepare for what's next and position themselves at the forefront of the field.

Automation and increased intelligence are likely to characterize the next generation of ${subunit_title} tools and techniques. Solutions that can self-optimize, adapt to changing conditions, and require less human intervention will become more prevalent, expanding the accessibility and impact of these technologies.

Integration with other emerging technologies such as augmented reality, blockchain, and quantum computing promises to create powerful new capabilities and applications. These technological convergences will likely spawn entirely new categories of solutions that address previously intractable problems.

Ethical frameworks and governance models for ${subunit_title} will continue to mature as societies grapple with the implications of these powerful technologies. Expect to see more standardized approaches to addressing concerns about privacy, bias, and transparency, potentially including both regulatory requirements and industry self-regulation.

Democratization of advanced ${subunit_title} capabilities through more accessible tools and platforms will accelerate in the coming years. This trend will allow a broader range of organizations and individuals to leverage sophisticated techniques without requiring deep technical expertise or extensive resources.

Specialized applications tailored to specific industries and use cases will proliferate as the technology matures. These purpose-built solutions will incorporate domain-specific knowledge and best practices, making implementation more straightforward and outcomes more relevant for particular contexts.

Human-centered design will gain prominence as a critical success factor in ${subunit_title} implementations. Solutions that thoughtfully consider the needs, capabilities, and experiences of the people who use them will achieve higher adoption rates and deliver greater value than those focused solely on technical performance.

Global collaboration and knowledge sharing will accelerate innovation in ${subunit_title}, with open-source communities, research consortia, and international standards bodies playing increasingly important roles in shaping the field's trajectory. This collective approach to advancement will help address common challenges and spread best practices worldwide.

## Conclusion

Throughout this comprehensive exploration of ${subunit_title}, we've covered fundamental principles, advanced techniques, practical applications, common challenges, best practices, and future trends. This knowledge provides a solid foundation for anyone seeking to understand or implement these powerful concepts.

The transformative potential of ${subunit_title} cannot be overstated, as it continues to revolutionize processes, enable new capabilities, and solve previously intractable problems across numerous domains. The practical benefits—improved efficiency, enhanced decision-making, and new opportunities for innovation—make this an essential area of expertise in today's technology-driven landscape.

As you continue your journey with ${subunit_title}, remember that mastery comes through a combination of theoretical understanding and practical application. The concepts discussed in this article gain meaningful depth when applied to real-world situations, tested against actual constraints, and refined through experience.

The future of ${subunit_title} promises even greater capabilities as technologies evolve and new methodologies emerge. Staying current with developments in the field, participating in professional communities, and maintaining a curious, experimental mindset will help you adapt to these changes and continue to derive value from your knowledge.

We encourage you to apply the insights from this article to your specific context, whether that involves implementing ${subunit_title} solutions in an organizational setting, conducting research to advance the field, or simply deepening your understanding of these powerful concepts for personal growth.

The journey of discovery in ${subunit_title} is ongoing, with new questions and possibilities emerging regularly. By building on the comprehensive foundation provided in this article, you'll be well-equipped to contribute to this exciting field and harness its potential for meaningful impact.`
          }
        };
        
        return new Response(JSON.stringify(fallbackContent), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      }
    }
  } catch (error) {
    console.error("Error in generate-article-content function:", error);
    
    const errorResponse = { 
      error: error.message,
      type: "article",
      status: "error",
      title: "Error Generating Content",
      content: {
        overview: "There was an error generating this article content. Please try again.",
        markdown: `## We're working on creating detailed content for ${subunit_title}
        
Our article generation process is currently experiencing some technical difficulties. We're working to resolve this issue and provide you with comprehensive, detailed content as soon as possible.

In the meantime, here are some key topics that will be covered in this article:

1. Introduction to ${subunit_title}
2. Core concepts and principles
3. Practical applications
4. Advanced techniques
5. Best practices
6. Case studies
7. Future trends

Each section will include multiple paragraphs of detailed information, practical examples, and relevant context to help you master this subject.

Please try refreshing or regenerating the module in a few moments.`
      }
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
