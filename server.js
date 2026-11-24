const express = require("express");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

app.get("/api/status", (_req, res) => res.json({ success: true, message: "NovaLearn AI backend is running!", aiConfigured: Boolean(openai) }));

app.post("/api/ask", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env and restart the server." });
    const { question, name, grade, subject, topic } = req.body || {};
    if (typeof question !== "string" || !question.trim() || !subject || !topic || !grade) return res.status(400).json({ error: "Please provide a question, grade, subject and topic." });
    if (question.length > 4000) return res.status(400).json({ error: "Please keep questions under 4,000 characters." });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: `You are NovaLearn, a supportive school tutor. Student: ${String(name || "Student").slice(0,60)}. Grade: ${String(grade).slice(0,10)}. Subject: ${String(subject).slice(0,50)}. Topic: ${String(topic).slice(0,100)}. Explain at the student's grade level, show clear steps and worked examples, check misconceptions, and do not invent facts. For maths and science, show the working.`,
      input: question.trim()
    });
    res.json({ success: true, answer: response.output_text || "I couldn't create an answer. Please try rephrasing." });
  } catch (error) {
    console.error("OpenAI /api/ask error:", error.status || "", error.message || error);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
    res.status(status).json({ error: status === 401 ? "The OpenAI API key was rejected. Check that you copied an active API key from the OpenAI API platform." : status === 429 ? "OpenAI rate limit or API quota reached. Check API billing and usage." : (error.message || "The AI could not respond.") });
  }
});

app.post("/api/generate-quiz", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env and restart the server." });
    const { grade, subject, topic, difficulty = "Mixed" } = req.body || {};
    if (!grade || !subject || !topic) return res.status(400).json({ error: "Grade, subject and topic are required." });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: "Create exactly 5 original school practice multiple-choice questions. Return only valid JSON, no markdown, in this exact shape: {\"questions\":[{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answerIndex\":0,\"explanation\":\"Short step-by-step explanation\"}]}. Exactly four options per question. answerIndex must be 0, 1, 2, or 3. Ensure one unambiguously correct answer and accurate explanations.",
      input: `Grade ${String(grade)}; subject ${String(subject)}; topic ${String(topic)}; difficulty ${String(difficulty)}. Create a balanced practice set.`
    });
    const raw = response.output_text || "";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (!Array.isArray(parsed.questions) || parsed.questions.length !== 5 || parsed.questions.some(q => !q.question || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3 || !q.explanation)) throw new Error("The generated quiz format was invalid. Please try again.");
    res.json({ success: true, questions: parsed.questions });
  } catch (error) {
    console.error("OpenAI /api/generate-quiz error:", error.status || "", error.message || error);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
    res.status(status).json({ error: error.message || "Quiz generation failed." });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`NovaLearn is running on port ${PORT}`));
