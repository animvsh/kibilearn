
// Adobe PDF Services API client utilities

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenData {
  access_token: string;
}

export async function getAdobeAccessToken(clientId: string, clientSecret: string, maxRetries = 3): Promise<string> {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const tokenResponse = await fetch('https://pdf-services.adobe.io/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'client_id': clientId,
          'client_secret': clientSecret
        })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token request failed:", errorText);
        throw new Error(`Token request failed: ${errorText}`);
      }
      
      const tokenData = await tokenResponse.json() as TokenData;
      return tokenData.access_token;
    } catch (error) {
      retryCount++;
      console.warn(`Failed to get Adobe token, attempt ${retryCount} of ${maxRetries}:`, error);
      if (retryCount === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  throw new Error('Failed to get Adobe access token after maximum retries');
}

export async function getAssetUploadUrl(accessToken: string, clientId: string): Promise<{ uploadUri: string; assetID: string }> {
  try {
    const assetResponse = await fetch('https://pdf-services.adobe.io/assets', {
      method: 'POST',
      headers: {
        'X-API-Key': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'mediaType': 'application/pdf'
      })
    });
    
    if (!assetResponse.ok) {
      const errorText = await assetResponse.text();
      console.error("Failed to get asset upload URL:", errorText);
      throw new Error(`Failed to get asset upload URL: ${errorText}`);
    }
    
    return await assetResponse.json();
  } catch (error) {
    console.error("Error in getAssetUploadUrl:", error);
    throw error;
  }
}

export async function uploadPdfToAdobe(uploadUri: string, fileArrayBuffer: ArrayBuffer, maxRetries = 3): Promise<void> {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const uploadResponse = await fetch(uploadUri, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf'
        },
        body: fileArrayBuffer
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`Upload failed (attempt ${retryCount+1}):`, errorText);
        throw new Error(`Upload failed: ${errorText}`);
      }
      
      console.log("PDF upload successful");
      return;
    } catch (error) {
      retryCount++;
      console.warn(`Failed to upload PDF, attempt ${retryCount} of ${maxRetries}:`, error);
      if (retryCount === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  throw new Error('Failed to upload PDF after maximum retries');
}
