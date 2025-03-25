const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { XMLParser } = require("fast-xml-parser");
const parser = new XMLParser();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(query) {
    return new Promise(resolve => rl.question(query, answer => resolve(answer.trim().toLowerCase())));
}

async function extractGameCode(page, title) {
    await page.waitForSelector('[data-code]', { timeout: 5000 }).catch(() => null);
    const dataCode = await page.$eval('[data-code]', el => el.getAttribute('data-code')).catch(() => null);
    if (!dataCode) {
        console.log(`Failed to extract game code from "${title}".`);
        return;
    };
    console.log(`Extracted game code for "${title}"`);
    const match = dataCode.match(/FILE_URL\s*=\s*(?:"|')(.*?)(?:"|')/);
    if (!match) {
        console.log("Failed to extract FILE_URL.");
        return;
    };
    
    const fileUrl = match[1];
    console.log(`Extracted FILE_URL: ${fileUrl}`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
        console.log("Failed to fetch game file.");
        return;
    }
    
    const xmlData = await response.text();
    const parsedData = parser.parse(xmlData);
    
    const content = parsedData['Module']['Content'];
    const filename = `${title.replace(/\s+/g, '_').toLowerCase()}.html`;
    const outputPath = path.join(__dirname, 'output', filename);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`Game code saved to ${outputPath}`);
    
    const test = await askQuestion("Would you like to test the file? (yes/no): ");
    if (test === 'yes') {
        const testBrowser = await puppeteer.launch({ headless: false });
        const testPage = await testBrowser.newPage();
        await testPage.goto(`file://${outputPath}`);
        await askQuestion("Press Enter to continue...");
        await testBrowser.close();
    }
}

async function processPage(browser, url, isBase) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });
    
    const title = (await page.title()).split('-').map(t => t.trim()).join(' - ');
    console.log(`Page Title: ${title}`);
    
    const extract = await askQuestion(`Would you like to extract game code from "${title}"? (yes/no): `);
    if (extract === 'yes') {
        await extractGameCode(page, title);
    }
    
    let links = [];
    if (isBase) {
        links = await page.$$eval('a', anchors => anchors.map(a => a.href));
        links = [...new Set(links.filter(href => href.startsWith('http')))].slice(0, 5);
    }
    
    for (const link of links) {
        console.log(`Next Link: ${link}`);
        const proceed = await askQuestion("Would you like to process this link? (yes/no): ");
        if (proceed === 'yes') {
            await processPage(browser, link, false);
        }
    }
    await page.close();
}

(async () => {
    const startUrl = process.argv[2] || "https://sites.google.com/view/drive-u-7-home/escape-road";
    const browser = await puppeteer.launch({ headless: false });
    await processPage(browser, startUrl, true);
    await browser.close();
    rl.close();
})();
