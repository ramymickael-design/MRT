export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const origin = req.headers.get('origin') || '';
  const allowed = ['https://mrtjournal.com', 'https://www.mrtjournal.com', 'https://mrt-one.vercel.app'];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];

  try {
    const body = await req.json();
    const { messages, system, max_tokens, image } = body;
    // image = { data: base64string, mediaType: 'image/jpeg'|'image/png'|'image/webp' }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }

    // If image included, inject into last user message as vision content
    let finalMessages = messages;
    if (image && image.data) {
      finalMessages = messages.map((msg, i) => {
        if (i === messages.length - 1 && msg.role === 'user') {
          const textContent = typeof msg.content === 'string'
            ? msg.content
            : msg.content?.find?.(c => c.type === 'text')?.text || '';
          return {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mediaType || 'image/jpeg',
                  data: image.data,
                }
              },
              { type: 'text', text: textContent }
            ]
          };
        }
        return msg;
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: max_tokens || 1000,
        system: system || '',
        messages: finalMessages,
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error', detail: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
      }
    });
  }
}
