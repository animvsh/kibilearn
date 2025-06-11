
// OCR and text extraction operations

export async function createOcrJob(accessToken: string, clientId: string, assetID: string) {
  try {
    const ocrJobResponse = await fetch('https://pdf-services.adobe.io/operation/ocr', {
      method: 'POST',
      headers: {
        'X-API-Key': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "assetID": assetID,
        "locale": "en-US",
        "ocrType": "searchable_image",
        "options": {
          "dcLang": "en-US",
          "optimizeScan": true,
          "autoDeskew": true
        }
      })
    });
    
    if (!ocrJobResponse.ok) {
      const errorText = await ocrJobResponse.text();
      throw new Error(`Failed to create OCR job: ${errorText}`);
    }
    
    const jobId = ocrJobResponse.headers.get('location')?.split('/').pop();
    if (!jobId) {
      throw new Error('No job ID found in OCR response');
    }
    
    return jobId;
  } catch (error) {
    console.error("Error creating OCR job:", error);
    throw error;
  }
}

export async function pollForOcrCompletion(accessToken: string, clientId: string, jobId: string) {
  let maxRetries = 30;
  let delayMs = 1000;
  
  while (maxRetries > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    try {
      const statusResponse = await fetch(`https://pdf-services.adobe.io/operation/ocr/${jobId}/status`, {
        headers: {
          'X-API-Key': clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to check OCR status: ${await statusResponse.text()}`);
      }
      
      const status = await statusResponse.json();
      console.log("OCR job status:", status.status);
      
      if (status.status === 'done') {
        return status;
      } else if (status.status === 'failed') {
        throw new Error(`OCR job failed: ${JSON.stringify(status.error || {})}`);
      }
    } catch (error) {
      console.warn("Error checking OCR status:", error);
      // Continue polling despite error
    }
    
    maxRetries--;
    delayMs = Math.min(delayMs * 1.5, 5000);
  }
  
  throw new Error('OCR job timed out');
}

export async function extractTextFromPdf(accessToken: string, clientId: string, assetID: string) {
  try {
    // Try to extract text with Adobe's text extraction API
    const extractResponse = await fetch('https://pdf-services.adobe.io/operation/extractpdf', {
      method: 'POST',
      headers: {
        'X-API-Key': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "assetID": assetID,
        "elements": [
          {
            "type": "text-extraction-element",
            "version": "3.0.0",
            "includeParagraphStyles": true,
            "includeTextStyle": true,
            "includeStructure": true
          }
        ]
      })
    });
    
    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`Failed to extract text from OCR'd PDF: ${errorText}`);
    }
    
    const extractJobId = extractResponse.headers.get('location')?.split('/').pop();
    if (!extractJobId) {
      throw new Error('No extract job ID found');
    }
    
    return await pollForTextExtraction(accessToken, clientId, extractJobId);
  } catch (error) {
    console.error("Error extracting text:", error);
    
    // Return a minimal content structure as fallback
    return {
      title: "PDF Content",
      paragraphs: [
        { text: "Basic text content extracted from document." }
      ],
      usingFallback: true
    };
  }
}

async function pollForTextExtraction(accessToken: string, clientId: string, extractJobId: string) {
  let maxRetries = 30;
  let delayMs = 1000;
  let lastError = null;
  
  while (maxRetries > 0) {
    try {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      const extractStatusResponse = await fetch(`https://pdf-services.adobe.io/operation/extractpdf/${extractJobId}/status`, {
        headers: {
          'X-API-Key': clientId,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!extractStatusResponse.ok) {
        throw new Error(`Failed to check extraction status: ${await extractStatusResponse.text()}`);
      }
      
      const status = await extractStatusResponse.json();
      console.log("Text extraction status:", status.status);
      
      if (status.status === 'done') {
        // Process the extracted content into a structured format
        try {
          const contentResponse = await fetch(`https://pdf-services.adobe.io/operation/extractpdf/${extractJobId}/result`, {
            headers: {
              'X-API-Key': clientId,
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (!contentResponse.ok) {
            throw new Error(`Failed to get extraction result: ${await contentResponse.text()}`);
          }
          
          const extractedContent = await contentResponse.json();
          
          // Process the extracted content into a more usable format
          return processExtractedContent(extractedContent);
        } catch (resultError) {
          console.error("Error getting extraction result:", resultError);
          throw resultError;
        }
      } else if (status.status === 'failed') {
        throw new Error(`Extraction failed: ${JSON.stringify(status.error || {})}`);
      }
    } catch (error) {
      lastError = error;
      console.warn("Error checking extraction status:", error);
    }
    
    maxRetries--;
    delayMs = Math.min(delayMs * 1.5, 5000);
  }
  
  throw new Error(lastError ? `Text extraction failed: ${lastError.message}` : 'Text extraction timed out');
}

function processExtractedContent(extractedContent: any) {
  // Default values if extraction fails or returns unexpected format
  let title = "PDF Document";
  const paragraphs: Array<{text: string}> = [];
  const headings: Array<{text: string, level: number}> = [];
  
  try {
    if (extractedContent && extractedContent.elements && Array.isArray(extractedContent.elements)) {
      // Try to extract document title if available
      const titleElement = extractedContent.elements.find(
        (el: any) => el.Path && (el.Path.includes('/Title') || el.Path.includes('/H1'))
      );
      if (titleElement && titleElement.Text) {
        title = titleElement.Text;
      }
      
      // Extract paragraphs and headings
      extractedContent.elements.forEach((element: any) => {
        if (element.Text && element.Text.trim()) {
          // Check if it's a heading (H1-H6)
          if (element.Path && /\/H[1-6]/.test(element.Path)) {
            const levelMatch = element.Path.match(/\/H([1-6])/);
            const level = levelMatch ? parseInt(levelMatch[1]) : 1;
            headings.push({
              text: element.Text.trim(),
              level
            });
          } 
          // Check if it's a paragraph
          else if (element.Path && element.Path.includes('/P')) {
            paragraphs.push({
              text: element.Text.trim()
            });
          }
          // Add other text content even if not explicitly marked as paragraph
          else if (element.Text && element.Text.trim().length > 5) {
            paragraphs.push({
              text: element.Text.trim()
            });
          }
        }
      });
    }
    
    // If no paragraphs were found, add a default one
    if (paragraphs.length === 0) {
      paragraphs.push({ text: "The document was processed but no text content could be extracted." });
    }
    
    return {
      title,
      headings,
      paragraphs,
      metadata: {
        pageCount: extractedContent.documentMetadata?.pageCount || 1,
        processedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("Error processing extracted content:", error);
    
    // Return minimal content if processing fails
    return {
      title: "PDF Content",
      headings: [],
      paragraphs: [{ text: "The document could not be properly parsed." }],
      metadata: {
        processingError: true,
        processedAt: new Date().toISOString()
      }
    };
  }
}
