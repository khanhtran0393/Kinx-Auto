const https = require('https');

// The Vercel app we just deployed
const PROXY_HOST = 'source-omega-ten.vercel.app';
const TARGET_APIS = [
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
    'api.elevenlabs.io'
];

function isTargetApi(hostname) {
    if (!hostname) return false;
    return TARGET_APIS.some(api => hostname.includes(api));
}

// 1. Patch Node.js https.request
const originalRequest = https.request;

function patchOptions(options) {
    let urlObj = null;
    let opts = {};

    if (typeof options === 'string' || options instanceof URL) {
        urlObj = new URL(options);
        opts = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            protocol: urlObj.protocol,
            port: urlObj.port
        };
    } else {
        opts = { ...options };
    }

    const hostname = opts.hostname || opts.host;

    if (isTargetApi(hostname)) {
        const originalHost = hostname;
        const originalPath = opts.path || '/';

        opts.hostname = PROXY_HOST;
        opts.host = PROXY_HOST;
        opts.port = 443;
        opts.path = '/api/proxy';
        
        if (!opts.headers) opts.headers = {};
        
        opts.headers['x-original-host'] = originalHost;
        opts.headers['x-original-path'] = originalPath;
        
        // Remove client-side API keys so they aren't accidentally leaked/used 
        // if they were hardcoded, and the proxy will inject the real ones from Supabase.
        delete opts.headers['authorization'];
        delete opts.headers['Authorization'];
        delete opts.headers['x-goog-api-key'];
    }

    return opts;
}

https.request = function(options, ...args) {
    let callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    let newOptions = patchOptions(options);
    
    // Support options merging
    if (args.length > 0 && typeof args[0] === 'object') {
        Object.assign(newOptions, args[0]);
        newOptions = patchOptions(newOptions);
    }

    if (callback) {
        return originalRequest.call(this, newOptions, callback);
    }
    return originalRequest.call(this, newOptions);
};

// 2. Patch Node.js global fetch
if (typeof global.fetch === 'function') {
    const originalFetch = global.fetch;
    global.fetch = async function(resource, config) {
        let urlObj;
        let isResourceString = typeof resource === 'string';
        let isResourceURL = resource instanceof URL;

        if (isResourceString) {
            urlObj = new URL(resource);
        } else if (isResourceURL) {
            urlObj = new URL(resource.href);
        } else if (resource && resource.url) {
            urlObj = new URL(resource.url);
        }

        if (urlObj && isTargetApi(urlObj.hostname)) {
            const originalHost = urlObj.hostname;
            const originalPath = urlObj.pathname + urlObj.search;

            urlObj.hostname = PROXY_HOST;
            urlObj.pathname = '/api/proxy';
            urlObj.search = '';

            let newResource = resource;
            if (isResourceString || isResourceURL) {
                newResource = urlObj.toString();
            } else if (resource instanceof Request) {
                newResource = new Request(urlObj.toString(), resource);
            }

            if (!config) config = {};
            if (!config.headers) config.headers = {};
            
            if (config.headers instanceof Headers) {
                config.headers.set('x-original-host', originalHost);
                config.headers.set('x-original-path', originalPath);
                config.headers.delete('authorization');
                config.headers.delete('x-goog-api-key');
            } else {
                config.headers['x-original-host'] = originalHost;
                config.headers['x-original-path'] = originalPath;
                delete config.headers['authorization'];
                delete config.headers['Authorization'];
                delete config.headers['x-goog-api-key'];
            }

            return originalFetch.call(this, newResource, config);
        }

        return originalFetch.call(this, resource, config);
    };
}

console.log('[Kinx Auto Proxy] Network patched to route AI traffic through Vercel backend.');
