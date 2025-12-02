import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Innertube } from "youtubei.js";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const app = express();

const allowedOrigins = [
  "https://victordeabreuandrade.github.io",
  "https://victordeabreuandrade.github.io/",
  "https://victordeabreuandrade.github.io/resumifai-web",
  "https://victordeabreuandrade.github.io/resumifai-web/",
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.post("/", async (req, res) => {
  const videoId = req.body.videoId;
  const url = req.body.url;
  const mode = req.body.mode;
  const wordLimit = req.body.wordLimit;

  console.log("Video ID:", videoId);
  console.log("Word limit:", wordLimit);

  if (!videoId) {
    return res.status(400).json({ error: "You must inform a video ID." });
  }

  let wordLimitPhrase = "";
  wordLimit !== "noLimits"
    ? (wordLimitPhrase = `Respect the limit of ${wordLimit} words. `)
    : null;

  let transcriptData;
  let transcript;

  try {
    // Obtaining the transcription
    if (url.includes("tiktok.com")) {
      console.log("Fetching transcript from TikTok...");
      const transcriptResponse = await fetch(
        "https://submagic-free-tools.fly.dev/api/tiktok-transcription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: url }),
        }
      );
      transcriptData = await transcriptResponse.json();

      if (!transcriptData) {
        return res.status(400).json({ error: "Transcription not found!" });
      }

      // Pega a última transcrição, remove o "WEBVTT" e os espaços do início em uma única linha
      transcript = Object.values(transcriptData.transcripts)
        .pop()
        .replace(/^WEBVTT\s*/, "");

    } else {
      console.log("Fetching transcript from YouTube...");
      const youtube = await Innertube.create({ retrieve_player: false });
      const info = await youtube.getInfo(`${videoId}`);
      transcriptData = await info.getTranscript();

      if (!transcriptData) {
        return res.status(400).json({ error: "Transcription not found!" });
      }

      let rawTranscript =
        transcriptData.transcript.content.body.initial_segments.map(
          (segment) => segment.snippet.text
        );
      transcript = rawTranscript.join(" ");
    }

    console.log("Transcription generated successfully!");

    // Generating the summary
    let prompt = "";
    if (mode == "StepByStep") {
      prompt = `Make a step-by-step from the text below, keeping the important information. Don't include information about ads and sponsorship. ${wordLimitPhrase}Finally, keep the step-by-step in the same language as the text. That's the text:\n\n${transcript}`;
    } else if (mode == "script") {
      prompt = `You are a famous influencer that make a living by producing viral videos to post on social media like YouTube, TikTok and Instagram. This text below is a transcript from another video. I want you to make a script from that, which will serve to produce a video to post on social media. Change the words, but keep the same meaning. You have to use a striking tone and a biting humor. Start with a viral and impactant phrase, to retain the user attention. Don't include information about ads and sponsorship. And I just want the text part, not title, images or scenes suggestions. ${wordLimitPhrase}Finally, this script should be created in Brazilian Portuguese. That's the text:\n\n${transcript}`;
    } else {
      prompt = `Sum up the text below, keeping the important information. Don't include information about ads and sponsorship. ${wordLimitPhrase}Finally, keep the summary in the same language as the text. That's the text:\n\n${transcript}`;
    }
    const result = await model.generateContent(prompt);
    const response = result.response.candidates[0].content.parts[0].text;

    console.log("Summary generated successfully!");
    res.status(200).json({ summary: response });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      error: "Error trying to extract the video transcription from the video.",
    });
  }
});

// Just use this part to run the server locally
// const PORT = process.env.PORT || 3002;

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

export default app;
