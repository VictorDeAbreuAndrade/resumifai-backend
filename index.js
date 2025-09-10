import { Router } from "itty-router";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Innertube } from "youtubei.js";

const router = Router();

const allowedOrigins = [
  "https://victordeabreuandrade.github.io",
  "https://victordeabreuandrade.github.io/",
  "https://victordeabreuandrade.github.io/resumifai-web",
  "https://victordeabreuandrade.github.io/resumifai-web/",
];

// Middleware to handle CORS
const handleCors = (request, response) => {
  const origin = request.headers.get("Origin");
  if (allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return response;
};

// GET /transcription/:id
router.get("/transcription/:id", async (request, env) => {
  const videoId = request.params.id;

  if (!videoId) {
    const response = new Response(
      JSON.stringify({ error: "You must inform a video ID." }),
      { status: 400 }
    );
    return handleCors(request, response);
  }

  try {
    const youtube = await Innertube.create({ retrieve_player: false });
    const info = await youtube.getInfo(`${videoId}`);
    const transcriptData = await info.getTranscript();

    if (!transcriptData) {
      const response = new Response(
        JSON.stringify({ error: "Transcription not found!" }),
        { status: 400 }
      );
      return handleCors(request, response);
    }

    const transcript =
      transcriptData.transcript.content.body.initial_segments.map(
        (segment) => segment.snippet.text
      );

    console.log("Transcription generated successfully!");
    const response = new Response(
      JSON.stringify({ transcription: transcript.join(" ") }),
      { status: 200 }
    );
    return handleCors(request, response);
  } catch (error) {
    console.error("Error:", error.message);
    const response = new Response(
      JSON.stringify({
        error:
          "Error trying to extract the video transcription from a YouTube video.",
      }),
      { status: 500 }
    );
    return handleCors(request, response);
  }
});

// POST /summary
router.post("/summary", async (request, env) => {
  const { transcription, wordLimit } = await request.json();

  let wordLimitPhrase = "";
  wordLimit !== "noLimits"
    ? (wordLimitPhrase = `Respect the limit of ${wordLimit} words. `)
    : null;

  if (!transcription) {
    const response = new Response(
      JSON.stringify({ error: "Transcription not found!" }),
      { status: 400 }
    );
    return handleCors(request, response);
  }

  try {
    const prompt = `Sum up the text below, keeping the important information. Don't include information about ads and sponsorship. ${wordLimitPhrase}Finally, keep the summary in the same language as the text. That's the text:\n\n${transcription}`;
    const genAI = new GoogleGenerativeAI(env.GOOGLE_GENERATIVE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.candidates[0].content.parts[0].text;

    console.log("Summary generated successfully!");
    const response = new Response(JSON.stringify({ summary: responseText }), {
      status: 200,
    });
    return handleCors(request, response);
  } catch (error) {
    console.error("Error:", error.message);
    const response = new Response(
      JSON.stringify({
        error: "Error trying to summarize the video. Problems with Gemini.",
      }),
      { status: 500 }
    );
    return handleCors(request, response);
  }
});

// Export the router for Cloudflare Workers
export default {
  fetch: (request, env) => router.handle(request, env),
};
