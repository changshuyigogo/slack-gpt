// GPT Webhook：支援 Slack Slash Command `/gpt`，限制特定 user_id 使用，回 ephemeral，✅ 加入 timeout-safe 回應
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ 只允許這些使用者使用 /gpt
const ALLOWED_USERS = [
  'D06CACLJS12',
  'U06CACLH4LU',
  'U069L1P6HDJ',
  'ULB8X2TFU',
  'U06NE138J31',
  'U06C7SGDK0S',
  'U05RSRKFSH2',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('收到 Slack 請求 headers:', req.headers);
    console.log('收到 Slack 請求 body:', req.body);

    const body = req.body || {};
    const text = body.text;
    const user_id = body.user_id;
    const response_url = body.response_url;

    console.log('解析結果:', { text, user_id, response_url });

    if (!text || !user_id || !response_url) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // ✅ 立即回應，避免 Slack timeout
    res.status(200).end();

    // 🔒 權限檢查（非同步）
    if (!ALLOWED_USERS.includes(user_id)) {
      await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: '⚠️ 你沒有權限使用 /gpt，請聯絡管理員。',
        }),
      });
      return;
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
  } catch (err) {
    console.error('GPT webhook error:', err);
  }
}
