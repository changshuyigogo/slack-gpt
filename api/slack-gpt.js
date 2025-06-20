import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, user, channel } = req.body;

  if (!text || !user || !channel) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: text }],
    });

    const answer = completion.choices[0].message.content;

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text: `<@${user}> 問：\n>${text}\n\n💡 GPT 回覆：\n${answer}`,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error with GPT or Slack:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
