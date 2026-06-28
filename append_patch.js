const fs = require('fs');
const PROXY_HOST = 'source-omega-ten.vercel.app';
const code = `

const { app: electronApp } = require('electron');
if (electronApp) {
  electronApp.on('web-contents-created', (event, contents) => {
    contents.on('did-finish-load', () => {
      contents.executeJavaScript(\`
        if (!window.__kinxAuthPatched) {
          window.__kinxAuthPatched = true;
          const _fetch = window.fetch;
          window.fetch = async function(...args) {
            let url = args[0];
            if (typeof url === 'string' && url.includes('tainguyenweb.com')) {
                const urlObj = new URL(url);
                args[0] = 'https://${PROXY_HOST}/api/auth?path=' + encodeURIComponent(urlObj.pathname + urlObj.search);
            } else if (url instanceof Request && url.url.includes('tainguyenweb.com')) {
                const urlObj = new URL(url.url);
                args[0] = new Request('https://${PROXY_HOST}/api/auth?path=' + encodeURIComponent(urlObj.pathname + urlObj.search), url);
            }
            return _fetch.apply(this, args);
          };
          const _open = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && url.includes('tainguyenweb.com')) {
                const urlObj = new URL(url);
                url = 'https://${PROXY_HOST}/api/auth?path=' + encodeURIComponent(urlObj.pathname + urlObj.search);
            }
            return _open.call(this, method, url, ...rest);
          };
        }
      \`);
    });
  });
}
`;
fs.appendFileSync('dist-electron/network-patch.js', code);
console.log("Appended UI script injection");
