const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const url = require('url');
const mime = require('mime-types');
async function interceptRequests(targetUrl, outputFolder, localOnly, allowedHosts, rewrites) {
    console.log("STARTING....")
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
    let requestCount = 0;
    const savedFiles = [];

    await fs.promises.mkdir(outputFolder, { recursive: true });

    await page.setRequestInterception(true);

    page.on('request', async (request) => {
        const rqNum = ++requestCount;
        const requestUrl = request.url();
        const parsedUrl = new URL(requestUrl);
        const targetHostname = new URL(targetUrl).hostname;
        if (requestUrl.includes("sitelock.js")) {
            console.log(`[${rqNum}]: ${requestUrl} -> Refusing (sitelock)`);
            // return false empty js script
            await request.respond({
                status: 200,
                contentType: 'application/javascript',
                body: 'console.log("sitelock.js blocked");'

            });
        } else {
            if (localOnly && parsedUrl.hostname !== targetHostname && (!allowedHosts || !allowedHosts.includes(parsedUrl.hostname))) {
                console.log(`[${requestCount}]: ${requestUrl} -> Skipping (localOnly flag)`);
                await request.continue();
                return;
            }
        }

        try {
            await request.continue();
            const manualResponse = await fetch(requestUrl);
            if (!manualResponse) {
                console.log(`[${rqNum}]: ${requestUrl} -> Failed to get manual response`);
                return;
            }
            // Convert the response to a buffer

            var arrayBuffer = await manualResponse.arrayBuffer();
            let buffer = Buffer.from(arrayBuffer);
            const headers = new Headers(manualResponse.headers);
            const contentType = headers.get('content-type') || 'application/octet-stream';

            let filePath = path.join(outputFolder, decodeURIComponent(parsedUrl.pathname));

            // Remove query parameters and hash from the file path
            filePath = filePath.split('?')[0].split('#')[0];

            // Determine file extension based on content type
            let fileExtension = mime.extension(contentType);

            if (!fileExtension) {
                // If mime-types package couldn't determine the extension, use the original one
                fileExtension = path.extname(filePath).slice(1);
            }

            if (!fileExtension && contentType && contentType.startsWith('text/')) {
                // Default to .html for text content without a specific extension
                fileExtension = 'html';
            }

            // Handle the case where the path ends with a trailing slash
            if (filePath.endsWith('/') || filePath.endsWith('\\')) {
                filePath = path.join(filePath, `index.${fileExtension || 'html'}`);
            } else if (!path.extname(filePath)) {
                // If there's no file extension in the original path, add the determined extension
                filePath = `${filePath || 'index'}.${fileExtension || 'bin'}`;
            }
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            if(rewrites && rewrites.length > 0 && contentType.startsWith('text/')) {
                let text = buffer.toString();
                for (const rewrite of rewrites) {
                    // Change the origin of the URL in the buffer to the local origin (relative path)
                    text = text.replaceAll(new URL(rewrite).origin + '/', '');
                }
                buffer = Buffer.from(text);
            }
            if(contentType.startsWith('text/')) {
                // normalize all URLs to be encoded
                buffer = Buffer.from(buffer.toString().replace(/(src|href|url)=["']([^"']+)["']/g, (match, p1, p2) => {
                    return `${p1}="${encodeURI(p2)}"`;
                }));
            }
            await fs.promises.writeFile(filePath, buffer);
            console.log(`[${rqNum}]: ${requestUrl} -> ${filePath} (${contentType})`);
            savedFiles.push(filePath);
        } catch (error) {
            console.error(`[${rqNum}]: Error processing ${requestUrl}: ${error.message}`);
        }
    });

    console.log(`Intercepting RQs from site <${targetUrl}> to folder <${outputFolder}>`);
    console.log('Requests...');

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 0 });
    } catch (error) {
        console.error(`Error navigating to ${targetUrl}: ${error.message}`);
    }

    // await browser.close();

    console.log(`Intercept complete, ${savedFiles.length} files saved from <${targetUrl}> to ${outputFolder}`);
}
module.exports = {interceptRequests};

if(require.main !== module) {
    return;
}
const [, , targetUrl, outputFolder, localOnlyFlag, allowedHosts] = process.argv;
const localOnly = localOnlyFlag === '--localOnly';

if (!targetUrl || !outputFolder) {
    console.error('Usage: node intercept.js <targetUrl> <outputFolder> [--localOnly]');
    process.exit(1);
}
// targets go to `output` folder
var rOutputFolder = path.join(__dirname, 'output');

interceptRequests(targetUrl, rOutputFolder, localOnly, allowedHosts);
