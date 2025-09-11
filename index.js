// import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Innertube } from "youtubei.js";

// dotenv.config({ path: ".env" }); // Retirada, pois incluí a chave da API direto nos segredos do Cloudfare

const genAI = new GoogleGenerativeAI(env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// const port = process.env.PORT; // Not used because Google Cloud Functions will use the resumifai function
const originFrontEnd = process.env.FRONT_END_URL;

const app = express();

const allowedOrigins = [
  "https://victordeabreuandrade.github.io",
  "https://victordeabreuandrade.github.io/",
  "https://victordeabreuandrade.github.io/resumifai-web",
  "https://victordeabreuandrade.github.io/resumifai-web/"
]

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.post("/", async (req, res) => {
  const videoId = req.body.videoId;
  const wordLimit = req.body.wordLimit;

  console.log("Video ID:", videoId);
  console.log("Word limit:", wordLimit);

  if (!videoId) {
    return res.status(400).json({ error: "You must inform a video ID." });
  }

  let wordLimitPhrase = ''
  wordLimit !== 'noLimits' ? wordLimitPhrase = `Respect the limit of ${wordLimit} words. ` : null

  try {

    // Obtaining the transcription
    const youtube = await Innertube.create({retrieve_player: false})
    const info = await youtube.getInfo(`${videoId}`);
    const transcriptData = await info.getTranscript();

    if (!transcriptData) {
      return res.status(400).json({ error: "Transcription not found!" });
    }

    const transcript = transcriptData.transcript.content.body.initial_segments.map(
      (segment) => segment.snippet.text
    );

    // console.log(transcript.join(" "));
    console.log("Transcription generated successfully!");

    // Generating the summary
    const prompt = `Sum up the text below, keeping the important information. Don't include information about ads and sponsorship. ${wordLimitPhrase}Finally, keep the summary in the same language as the text. That's the text:\n\n${transcript.join(" ")}`;
    const result = await model.generateContent(prompt);
    const response = result.response.candidates[0].content.parts[0].text;

    console.log("Summary generated successfully!");
    res.status(200).json({ summary: response });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      error:
        "Error trying to extract the video transcription from a YouTube video.",
    });
  }
});

// Comment this line because Google Cloud Functions will use the resumifai function
// app.listen(port, () => console.log(`Backend is running on port ${port}`));

export const resumifaiSummarizer = app;
