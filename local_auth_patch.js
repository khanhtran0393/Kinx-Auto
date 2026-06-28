const fs = require('fs');

const code = `
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
`;
fs.appendFileSync('dist-electron/network-patch.js', code);
console.log("Appended Local Auth Proxy to network-patch.js");
