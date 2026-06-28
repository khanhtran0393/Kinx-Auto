const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join('D:\\', 'Kinx Auto', 'network_logs.txt');

function logNetwork(url, method, headers, body) {
    try {
        const logEntry = `\n[${new Date().toISOString()}] ${method || 'GET'} ${url}\nHeaders: ${JSON.stringify(headers || {})}\nBody: ${body ? (typeof body === 'string' ? body : JSON.stringify(body)) : ''}\n------------------------------------------------`;
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {}
}

// The Vercel app we just deployed
const PROXY_HOST = 'source-omega-ten.vercel.app';
const TARGET_APIS = [
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
    'api.elevenlabs.io'
];
const AUTH_APIS = ['tainguyenweb.com'];

function isTargetApi(hostname) {
    if (!hostname) return false;
    return TARGET_APIS.some(api => hostname.includes(api));
}

function isAuthApi(hostname) {
    if (!hostname) return false;
    return AUTH_APIS.some(api => hostname.includes(api));
}

// 1. Patch Node.js https.request & http.request
const originalHttpsRequest = https.request;
const originalHttpRequest = http.request;

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
    
    logNetwork(`${opts.protocol || 'https:'}//${hostname}${opts.path || '/'}`, opts.method, opts.headers, null);

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
        
        delete opts.headers['authorization'];
        delete opts.headers['Authorization'];
        delete opts.headers['x-goog-api-key'];
    } else if (isAuthApi(hostname)) {
        const originalHost = hostname;
        const originalPath = opts.path || '/';

        opts.hostname = PROXY_HOST;
        opts.host = PROXY_HOST;
        opts.port = 443;
        opts.path = '/api/auth';
        
        if (!opts.headers) opts.headers = {};
        opts.headers['x-original-host'] = originalHost;
        opts.headers['x-original-path'] = originalPath;
    }

    return opts;
}

https.request = function(options, ...args) {
    let callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    let newOptions = patchOptions(options);
    
    if (args.length > 0 && typeof args[0] === 'object') {
        Object.assign(newOptions, args[0]);
        newOptions = patchOptions(newOptions);
    }

    const req = callback ? originalHttpsRequest.call(this, newOptions, callback) : originalHttpsRequest.call(this, newOptions);
    
    // Intercept body chunks to log them
    const originalWrite = req.write;
    req.write = function(chunk, ...rest) {
        logNetwork(`[BODY CHUNK] -> ${newOptions.hostname}${newOptions.path}`, newOptions.method, null, chunk);
        return originalWrite.apply(this, [chunk, ...rest]);
    };
    
    return req;
};

http.request = function(options, ...args) {
    let callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    let newOptions = patchOptions(options);
    
    if (args.length > 0 && typeof args[0] === 'object') {
        Object.assign(newOptions, args[0]);
        newOptions = patchOptions(newOptions);
    }

    const req = callback ? originalHttpRequest.call(this, newOptions, callback) : originalHttpRequest.call(this, newOptions);
    
    // Intercept body chunks to log them
    const originalWrite = req.write;
    req.write = function(chunk, ...rest) {
        logNetwork(`[BODY CHUNK] -> ${newOptions.hostname}${newOptions.path}`, newOptions.method, null, chunk);
        return originalWrite.apply(this, [chunk, ...rest]);
    };
    
    return req;
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
        
        let reqMethod = config && config.method ? config.method : 'GET';
        let reqBody = config && config.body ? config.body : null;
        let reqHeaders = config && config.headers ? config.headers : null;

        logNetwork(urlObj ? urlObj.toString() : 'UNKNOWN URL', reqMethod, reqHeaders, reqBody);

        if (urlObj && (isTargetApi(urlObj.hostname) || isAuthApi(urlObj.hostname))) {
            const originalHost = urlObj.hostname;
            const originalPath = urlObj.pathname + urlObj.search;

            urlObj.hostname = PROXY_HOST;
            urlObj.pathname = isAuthApi(originalHost) ? '/api/auth' : '/api/proxy';
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

// 3. Patch Electron Session to intercept UI network calls (Auth/Login)
try {
    const electron = require('electron');
    if (electron && electron.app) {
        electron.app.on('ready', () => {
            const session = electron.session;
            if (session && session.defaultSession) {
                // Intercept all requests from Chromium
                session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
                    const url = details.url;
                    
                    try {
                        const urlObj = new URL(url);
                        if (isAuthApi(urlObj.hostname)) {
                            logNetwork(`[CHROMIUM AUTH INTERCEPT] -> ${url}`, details.method, details.requestHeaders || {}, null);
                            
                            // Redirect to our Vercel Auth API
                            const redirectURL = `https://${PROXY_HOST}/api/auth?path=${encodeURIComponent(urlObj.pathname + urlObj.search)}`;
                            return callback({ redirectURL });
                        }
                    } catch (e) {}

                    callback({ cancel: false });
                });
                
                // Modify Headers to handle CORS if needed (optional)
                session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                    try {
                        const urlObj = new URL(details.url);
                        if (urlObj.hostname === PROXY_HOST && urlObj.pathname === '/api/auth') {
                            const responseHeaders = Object.assign({}, details.responseHeaders);
                            responseHeaders['Access-Control-Allow-Origin'] = ['*'];
                            responseHeaders['Access-Control-Allow-Headers'] = ['*'];
                            return callback({ cancel: false, responseHeaders });
                        }
                    } catch (e) {}
                    callback({ cancel: false });
                });
            }
        });
    }
} catch (e) {
    // Electron might not be fully loaded here, ignore
}

console.log('[Kinx Auto Proxy] Network patched to route AI traffic to /api/proxy and Auth to /api/auth');


const { app: electronApp } = require('electron');
if (electronApp) {
  electronApp.on('web-contents-created', (event, contents) => {
    contents.on('did-finish-load', () => {
      contents.executeJavaScript(`
        if (!window.__kinxAuthPatched) {
          window.__kinxAuthPatched = true;
          const _fetch = window.fetch;
          window.fetch = async function(...args) {
            let url = args[0];
            if (typeof url === 'string' && url.includes('tainguyenweb.com')) {
                const urlObj = new URL(url);
                args[0] = 'https://source-omega-ten.vercel.app/api/auth?path=' + encodeURIComponent(urlObj.pathname + urlObj.search);
            } else if (url instanceof Request && url.url.includes('tainguyenweb.com')) {
                const urlObj = new URL(url.url);
                args[0] = new Request('https://source-omega-ten.vercel.app/api/auth?path=' + encodeURIComponent(urlObj.pathname + urlObj.search), url);
            }
            return _fetch.apply(this, args);
          };
          const _open = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && url.includes('tainguyenweb.com')) {
                const urlObj = new URL(url);
                url = 'https://source-omega-ten.vercel.app/api/auth?path=' + encodeURIComponent(urlObj.pathname + urlObj.search);
            }
            return _open.call(this, method, url, ...rest);
          };
        }
      `);
    });
  });
}

const { ipcMain } = require('electron');

// We intercept ipcMain.handle to catch 'fetch-api'
if (ipcMain) {
    const originalHandle = ipcMain.handle;
    ipcMain.handle = function(channel, listener) {
        if (channel === 'fetch-api') {
            const originalListener = listener;
            listener = async function(event, args) {
                if (args && args.url && args.url.includes('tainguyenweb.com')) {
                    try {
                        console.log('[LOCAL AUTH INTERCEPT] Intercepted fetch-api to:', args.url);
                        
                        // Parse body
                        let bodyStr = '';
                        if (args.options && args.options.body) {
                            bodyStr = args.options.body;
                        }

                        let body = {};
                        if (typeof bodyStr === 'string') {
                            try {
                                body = JSON.parse(bodyStr);
                            } catch(e) {
                                try {
                                    const urlParams = new URLSearchParams(bodyStr);
                                    body = Object.fromEntries(urlParams);
                                } catch(e2) {}
                            }
                        }

                        const email = body.email || body.username || body.user;
                        const password = body.password || body.pass;

                        console.log('[LOCAL AUTH INTERCEPT] Extracted Email:', email);

                        if (!email || !password) {
                            return {
                                status: 400,
                                data: JSON.stringify({ status: 400, success: false, message: "Missing email or password" })
                            };
                        }

                        // Query Supabase directly
                        const SUPABASE_URL = 'https://enoectunfjojhplwenli.supabase.co/rest/v1/users';
                        const SUPABASE_KEY = 'YOUR_SUPABASE_SECRET';
                        
                        const supabaseRes = await new Promise((resolve, reject) => {
                            const https = require('https');
                            const req = https.request(SUPABASE_URL + '?email=eq.' + encodeURIComponent(email) + '&password=eq.' + encodeURIComponent(password), {
                                method: 'GET',
                                headers: {
                                    'apikey': SUPABASE_KEY,
                                    'Authorization': 'Bearer ' + SUPABASE_KEY
                                }
                            }, (res) => {
                                let data = '';
                                res.on('data', chunk => data += chunk);
                                res.on('end', () => resolve({ status: res.statusCode, data }));
                            });
                            req.on('error', reject);
                            req.end();
                        });

                        if (supabaseRes.status === 200) {
                            const users = JSON.parse(supabaseRes.data);
                            if (users && users.length > 0) {
                                const user = users[0];
                                const mockResponse = {
                                    status: 200,
                                    success: true,
                                    message: "Login successful",
                                    token: "kinx-auto-premium-token-bypass-2099",
                                    data: {
                                        id: user.id,
                                        email: user.email,
                                        role: user.role || "admin",
                                        plan: "premium",
                                        expire_date: "2099-12-31T23:59:59.000Z",
                                        status: "active",
                                        is_active: true
                                    }
                                };
                                return {
                                    status: 200,
                                    data: JSON.stringify(mockResponse)
                                };
                            }
                        }

                        return {
                            status: 401,
                            data: JSON.stringify({ status: 401, success: false, message: "Sai tài khoản hoặc mật khẩu" })
                        };
                    } catch (err) {
                        console.error('[LOCAL AUTH INTERCEPT ERROR]', err);
                    }
                }
                return originalListener.apply(this, arguments);
            };
        }
        return originalHandle.call(this, channel, listener);
    };
}
