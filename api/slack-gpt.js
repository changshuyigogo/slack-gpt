// GPT Webhook：支援 Slack Slash Command `/gpt` 指令，並限制特定 user_id 使用
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ 只允許這些使用者使用 /gpt
const ALLOWED_USERS = ['U06CACLH4LU'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Slack slash command 是 x-www-form-urlencoded 格式
  const body = new URLSearchParams(req.body);
  const text = body.get('text');
  const user_id = body.get('user_id');
  const channel_id = body.get('channel_id');

  if (!text || !user_id || !channel_id) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  // 👉 權限過濾
  if (!ALLOWED_USERS.includes(user_id)) {
    return res.status(200).send('⚠️ 你沒有權限使用 /gpt，請聯絡管理員。');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: text }],
    });

    const answer = completion.choices[0].message.content;

    // 回傳訊息給 Slack
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response_type: 'ephemeral',
        channel: channel_id,
        text: `<@${user_id}> 問：\n>${text}\n\n💡 GPT 回覆：\n${answer}`,
      }),
    });

    // Slash command 回應（立刻回 200，避免超時）
    return res.status(200).send();
  } catch (err) {
    console.error('GPT webhook error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
