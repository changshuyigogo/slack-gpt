export default async function handler(req, res) {
  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    const json = await r.json();
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({
      error: 'fetch failed',
      message: err.message,
    });
  }
}
