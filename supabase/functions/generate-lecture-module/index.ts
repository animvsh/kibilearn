
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Get secrets
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

// CORS headers for browser calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function searchYoutubeVideo(query: string) {
  // Craft a better search query for educational content
  const enhancedQuery = `${query} tutorial OR lecture OR explanation educational`;
  
  // Try to find 10 results instead of 5 to increase chances of finding a good match
  const url = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(enhancedQuery)}&key=${YOUTUBE_API_KEY}&videoDuration=medium&order=relevance`;

  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    // Try again with a broader search query if no results found
    const broadQuery = `${query} educational`;
    const broadUrl = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(broadQuery)}&key=${YOUTUBE_API_KEY}&order=viewCount`;
    
    const broadRes = await fetch(broadUrl, { method: "GET" });
    const broadData = await broadRes.json();
    
    if (!broadData.items || !Array.isArray(broadData.items) || broadData.items.length === 0) {
      return null;
    }
    
    return broadData.items;
  }
  
  return data.items;
}

// Fetch details for a videoId (to get duration etc)
async function fetchVideoDetails(videoId: string) {
  const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) return null;
  return data.items[0];
}

// Extract ISO 8601 duration in seconds
function parseISODuration(iso: string): number {
  let match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  let h = parseInt(match[1] || "0", 10);
  let m = parseInt(match[2] || "0", 10);
  let s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

// Fetch transcript using public API (youtubetranscript.com as fallback)
async function fetchEnglishTranscript(videoId: string): Promise<string | null> {
  try {
    // Try youtubetranscript.com (allows CORS - for server)
    const res = await fetch(`https://youtubetranscript.com/api/transcript/${videoId}?lang=en`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Format transcript with proper spacing between segments
        return data
          .map((chunk: any) => chunk.text)
          .join(" ")
          .replace(/\s{2,}/g, " ")
          .trim();
      } else if (typeof data.transcript === "string") {
        return data.transcript;
      }
    }
    
    // If we reach here, try alternate API endpoints
    // These are fallback options if the primary method fails
    try {
      const alternateRes = await fetch(`https://transcripts.youai.ai/${videoId}.json`);
      if (alternateRes.ok) {
        const data = await alternateRes.json();
        if (data.transcript) {
          return data.transcript;
        }
      }
    } catch (err) {
      console.error("Alternate transcript API failed:", err);
    }
    
  } catch (_) {
    console.error("Transcript fetch failed");
  }

  // Create a fallback transcript that explains we couldn't fetch it
  return "Transcript could not be automatically extracted. Please watch the video for the full content.";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subunit_id, subunit_title, learning_goal } = await req.json();

    if (!subunit_id || !subunit_title) {
      return new Response(JSON.stringify({ error: "Missing subunit_id or subunit_title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Search YouTube videos for relevant educational lecture (4-25 min, sort by relevance first then view count)
    const query = `${subunit_title} tutorial lecture`;
    const candidates = await searchYoutubeVideo(query);
    
    if (!candidates || candidates.length === 0) {
      // If no videos found, return an error
      return new Response(JSON.stringify({ 
        error: "No videos found",
        lectureModule: {
          type: "lecture",
          subunit_id,
          title: `Lecture: ${subunit_title}`,
          status: "error",
          searchKeyword: `${subunit_title} lecture tutorial`,
          content: {
            video: null,
            transcript: "No suitable YouTube lecture video found. Please try with a different search query."
          }
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let bestVideo = null;
    let wideDuration = false;
    
    // First pass: try to find videos in the optimal range (4-25 mins)
    for (const item of candidates) {
      const vidId = item.id.videoId;
      const detail = await fetchVideoDetails(vidId);
      if (!detail) continue;
      const durationSec = parseISODuration(detail.contentDetails.duration);

      // Allow 4-25 mins (240 to 1500 seconds)
      if (durationSec >= 240 && durationSec <= 1500) {
        bestVideo = {
          video_id: vidId,
          title: detail.snippet.title,
          duration: detail.contentDetails.duration,
          channel_title: detail.snippet.channelTitle,
          published_at: detail.snippet.publishedAt,
        };
        break; // Take first match in duration range
      }
    }

    // Second pass: if no optimal videos found, accept a wider range (2-30 mins)
    if (!bestVideo) {
      wideDuration = true;
      for (const item of candidates) {
        const vidId = item.id.videoId;
        const detail = await fetchVideoDetails(vidId);
        if (!detail) continue;
        const durationSec = parseISODuration(detail.contentDetails.duration);

        // Allow 2-30 mins (120 to 1800 seconds)
        if (durationSec >= 120 && durationSec <= 1800) {
          bestVideo = {
            video_id: vidId,
            title: detail.snippet.title,
            duration: detail.contentDetails.duration,
            channel_title: detail.snippet.channelTitle,
            published_at: detail.snippet.publishedAt,
          };
          break;
        }
      }
    }

    // Third pass: if still no videos found, just take the first video
    if (!bestVideo && candidates.length > 0) {
      const item = candidates[0];
      const vidId = item.id.videoId;
      const detail = await fetchVideoDetails(vidId);
      
      if (detail) {
        bestVideo = {
          video_id: vidId,
          title: detail.snippet.title,
          duration: detail.contentDetails.duration,
          channel_title: detail.snippet.channelTitle,
          published_at: detail.snippet.publishedAt,
        };
      }
    }

    if (!bestVideo) {
      return new Response(JSON.stringify({ 
        error: "Could not process any videos",
        lectureModule: {
          type: "lecture",
          subunit_id,
          title: `Lecture: ${subunit_title}`,
          status: "error",
          searchKeyword: `${subunit_title} lecture tutorial`,
          content: {
            video: null,
            transcript: "Could not process YouTube video data. Please try again later."
          }
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Fetch transcript for the chosen video
    let transcript = await fetchEnglishTranscript(bestVideo.video_id);
    if (!transcript) {
      transcript = "Transcript not available for this video.";
    }

    // Format transcript for better display
    const formattedTranscript = transcript
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple line breaks
      .replace(/(?:^|\n)(\d+:\d+)/g, "\n\n$1"); // Add spacing around timestamps

    // Build response per prompt spec
    const lectureModule = {
      type: "lecture",
      subunit_id,
      title: `Lecture: ${bestVideo.title}`,
      status: "ready",
      content: {
        video: {
          video_id: bestVideo.video_id,
          title: bestVideo.title,
          duration: bestVideo.duration,
          channel: bestVideo.channel_title,
          published_at: bestVideo.published_at,
          duration_note: wideDuration ? "This video falls outside the ideal duration range but was selected for relevance" : null
        },
        transcript: formattedTranscript
      }
    };

    return new Response(JSON.stringify({ lectureModule }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in generate-lecture-module:", e);
    return new Response(JSON.stringify({ 
      error: e.message || String(e),
      lectureModule: {
        type: "lecture",
        title: "Lecture Module (Error)",
        status: "error",
        content: {
          video: null,
          transcript: `Could not generate lecture module: ${e.message || "Unknown error"}`
        }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
