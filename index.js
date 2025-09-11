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
  } else {
    response.headers.set("Access-Control-Allow-Origin", "null");
  }
  return response; // Certifique-se de retornar o objeto Response
};

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
  );
  return Promise.race([promise, timeout]);
};

router.post("/", async (request, env) => {
  try {
    // Parse o corpo da requisição
    const { videoId, wordLimit } = await request.json();

    console.log("Video ID:", videoId);
    console.log("Word limit:", wordLimit);

    if (!videoId) {
      const response = new Response(
        JSON.stringify({ error: "You must inform a video ID." }),
        { status: 400 }
      );
      return handleCors(request, response);
    }

    let wordLimitPhrase = "";
    if (wordLimit !== "noLimits") {
      wordLimitPhrase = `Respect the limit of ${wordLimit} words. `;
    }

    // Obtendo a transcrição
    console.log("Initializing YouTube API...");
    const youtube = await withTimeout(
      Innertube.create({ retrieve_player: false }),
      10000
    ); // Timeout de 10 segundos
    console.log("YouTube API initialized.");

    console.log("Fetching video info...");
    const info = await withTimeout(youtube.getInfo(`${videoId}`), 20000); // Timeout de 20 segundos
    console.log("Video info fetched.");

    console.log("Fetching transcript...");
    const transcriptData = await withTimeout(info.getTranscript(), 10000); // Timeout de 10 segundos
    console.log("Transcript fetched.");

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

    // Gerando o resumo
    const prompt = `Sum up the text below, keeping the important information. Don't include information about ads and sponsorship. ${wordLimitPhrase}Finally, keep the summary in the same language as the text. That's the text:\n\n${transcript.join(
      " "
    )}`;
    const genAI = new GoogleGenerativeAI(env.GOOGLE_GENERATIVE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await withTimeout(model.generateContent(prompt), 10000); // Timeout de 10 segundos
    const responseText = result.response.candidates[0].content.parts[0].text;

    console.log("Summary generated successfully!");
    const response = new Response(JSON.stringify({ summary: responseText }), {
      status: 200,
    });
    return handleCors(request, response);
  } catch (error) {
    console.error("Error:", error.message);

    // Retorna uma resposta de erro genérica
    const response = new Response(
      JSON.stringify({
        error: "An error occurred while processing your request.",
        details: error.message,
      }),
      { status: 500 }
    );
    return handleCors(request, response);
  }
});

// Handle preflight requests
router.options("*", (request) => {
  const response = new Response(null, { status: 204 });
  handleCors(request, response);
  return response;
});

router.get("/health", (request) => {
  const response = new Response(
    JSON.stringify({ status: "ok", message: "Worker is running!" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
  return response;
});

// Export the router for Cloudflare Workers
export default {
  fetch: async (request, env) => {
    return router.handle(request, env);
  },
};
