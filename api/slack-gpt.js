// GPT Webhook：支援 Slack Slash Command `/gpt` 指令，並限制特定 user_id 使用，改用 response_url 回 ephemeral
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ 只允許這些使用者使用 /gpt
const ALLOWED_USERS = ['U06CACLH4LU'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('收到 Slack 請求 headers:', req.headers);
    const rawText = await req.text();
    console.log('收到 Slack 請求 body:', rawText);

    const body = new URLSearchParams(rawText);
    const text = body.get('text');
    const user_id = body.get('user_id');
    const response_url = body.get('response_url');

    console.log('解析結果:', { text, user_id, response_url });

    if (!text || !user_id || !response_url) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!ALLOWED_USERS.includes(user_id)) {
      await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: '⚠️ 你沒有權限使用 /gpt，請聯絡管理員。',
        }),
      });
      return res.status(200).end();
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: text }],
    });

    const answer = completion.choices[0].message.content;

    await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: `💡 GPT 回覆：\n${answer}`,
      }),
    });

    return res.status(200).end();
  } catch (err) {
    console.error('GPT webhook error:', err);
    return res.status(500).end();
  }
}
