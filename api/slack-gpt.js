const ALLOWED_USERS = [
  'U06CACLH4LU',
  'U069L1P6HDJ',
  'ULB8X2TFU',
  'U06NE138J31',
  'U06C7SGDK0S',
  'U05RSRKFSH2',
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GPT 回覆逾時')), ms)
    ),
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('➡️ 收到 Slack 請求');
    console.log('headers:', req.headers);
    console.log('body:', req.body);

    const body = req.body || {};
    const { text, user_id, response_url } = body;
    console.log('➡️ 解析完成:', { text, user_id, response_url });

    if (!text || !user_id || !response_url) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // ✅ 回應 Slack 避免超時
    res.status(200).end();

    // 🔒 權限檢查
    if (!ALLOWED_USERS.includes(user_id)) {
      console.log('⛔️ 無權使用，user_id:', user_id);
      const slackRes = await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ 抱歉，你沒有權限使用這個指令。',
        }),
      });
      console.log(
        'Slack 回傳結果（無權）:',
        slackRes.status,
        await slackRes.text()
      );
      return;
    }

    // ✅ GPT 呼叫 with timeout（使用 fetch）
    let answer = '';
    try {
      console.log('📤 使用 fetch 呼叫 GPT...');
      const openaiRes = await withTimeout(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: text }],
          }),
        }),
        20000
      );

      const data = await openaiRes.json();
      console.log('📥 OpenAI 原生回應：', data);

      if (data?.choices?.[0]?.message?.content) {
        answer = data.choices[0].message.content;
      } else {
        answer = '⚠️ GPT 沒有回覆內容';
      }
    } catch (err) {
      console.error('❌ GPT 回應失敗:', err);
      answer =
        err.message === 'GPT 回覆逾時'
          ? '⚠️ GPT 回覆逾時，請稍後再試。'
          : '(⚠️ GPT 回應失敗)';
    }

    // 📬 回 Slack
    console.log('➡️ 傳送結果到 Slack...');
    const slackRes = await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: `💡 GPT 回覆：\n${answer}`,
      }),
    });
    console.log('✅ Slack 回傳結果:', slackRes.status, await slackRes.text());
  } catch (err) {
    console.error('❌ webhook error:', err);
  }
}
