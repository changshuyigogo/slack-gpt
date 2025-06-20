// GPT Webhook：支援 Slack Slash Command `/gpt`，限制特定 user_id 使用，回 ephemeral，✅ 加入 timeout-safe 回應
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ 只允許這些使用者使用 /gpt
const ALLOWED_USERS = [
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

    // ✅ 避免 timeout：先回 Slack 200
    res.status(200).end();

    // 🔒 權限檢查
    if (!ALLOWED_USERS.includes(user_id)) {
      const slackRes = await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ 抱歉，你沒有權限使用這個指令。',
        }),
      });
      console.log('Slack 回傳結果：', slackRes.status, await slackRes.text());
      return;
    }

    // ✅ GPT 回覆邏輯，加上 try-catch 與 log
    let answer = '';
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: text }],
      });

      console.log('OpenAI 回傳內容：', completion);
      answer = completion.choices?.[0]?.message?.content ?? '(⚠️ GPT 沒回內容)';
    } catch (err) {
      console.error('⚠️ GPT 回應失敗:', err);
      answer = '(⚠️ GPT 回應失敗)';
    }

    // ✅ 回覆到 Slack
    const slackRes = await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: `💡 GPT 回覆：\n${answer}`,
      }),
    });
    console.log('Slack 回傳結果：', slackRes.status, await slackRes.text());
  } catch (err) {
    console.error('GPT webhook error:', err);
  }
}
