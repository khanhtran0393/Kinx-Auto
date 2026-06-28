import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enoectunfjojhplwenli.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  try {
    const originalHost = req.headers['x-original-host'];
    let originalPath = req.headers['x-original-path'] || req.url.replace('/api/proxy', '');
    if (!originalPath || originalPath === '') originalPath = '/';
    
    // Ensure the path starts with '/'
    if (!originalPath.startsWith('/')) {
        originalPath = '/' + originalPath;
    }

    if (!originalHost) {
      return res.status(400).json({ error: 'Missing x-original-host header' });
    }

    // Since we are proxying, we might have query params in req.url, but originalPath should ideally contain them
    // If originalPath does not have query params and req.url does, we might need to append them. 
    // In our network patch, we will pass the exact full path + query in x-original-path.
    
    const targetUrl = `https://${originalHost}${originalPath}`;

    let platform = 'unknown';
    if (originalHost.includes('generativelanguage.googleapis.com')) {
      platform = 'gemini';
    } else if (originalHost.includes('api.openai.com')) {
      platform = 'openai';
    } else if (originalHost.includes('anthropic.com')) {
      platform = 'anthropic';
    } else if (originalHost.includes('api.elevenlabs.io')) {
      platform = 'elevenlabs';
    }

    let apiKey = null;
    if (platform !== 'unknown') {
      const { data, error } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('platform', platform)
        .single();
      
      if (!error && data) {
        apiKey = data.key_value;
      }
    }

    const forwardHeaders = { ...req.headers };
    delete forwardHeaders['host'];
    delete forwardHeaders['x-original-host'];
    delete forwardHeaders['x-original-path'];
    delete forwardHeaders['connection'];

    if (apiKey) {
      if (platform === 'gemini') {
        forwardHeaders['x-goog-api-key'] = apiKey;
      } else if (platform === 'openai' || platform === 'anthropic') {
        forwardHeaders['authorization'] = `Bearer ${apiKey}`;
      } else if (platform === 'elevenlabs') {
        forwardHeaders['xi-api-key'] = apiKey;
      }
    }

    const options = {
      method: req.method,
      headers: forwardHeaders,
      duplex: 'half',
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = req;
    }

    const response = await fetch(targetUrl, options);

    response.headers.forEach((value, key) => {
        // Exclude headers that might cause issues when proxying
        if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
            res.setHeader(key, value);
        }
    });

    res.status(response.status);

    if (response.body) {
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
    } else {
        res.end();
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
