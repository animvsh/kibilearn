
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const apiTemplateKey = Deno.env.get('APITEMPLATE_API_KEY') || '';

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
    // Check if API key is available
    if (!apiTemplateKey) {
      return new Response(JSON.stringify({ 
        status: 'error',
        error: 'API Template key not configured'
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Parse request body
    const { template_id, data, export_type = 'json' } = await req.json();
    
    if (!template_id || !data) {
      return new Response(JSON.stringify({ 
        status: 'error',
        error: 'Template ID and data are required'
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Call APITemplate.io API
    const response = await fetch('https://rest-us.apitemplate.io/v2/create-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiTemplateKey
      },
      body: JSON.stringify({
        template_id: template_id,
        export_type: export_type,
        data: data
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`APITemplate.io API error (${response.status}):`, errorText);
      
      return new Response(JSON.stringify({ 
        status: 'error',
        error: `APITemplate.io API error: ${errorText}`
      }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Return the API response
    const apiResponse = await response.json();
    return new Response(JSON.stringify(apiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error processing PDF template generation:', error);
    return new Response(JSON.stringify({ 
      status: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
