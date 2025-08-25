const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { XMLParser } = require("fast-xml-parser");
const { interceptRequests } = require('./index.js');
const parser = new XMLParser();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(query) {
    return new Promise(resolve => rl.question(query, answer => resolve(answer.trim().toLowerCase())));
}
async function extractGameCode(page, title) {
    // Extract data-code attribute
    const dataCode = await page.$eval('[data-code]', el => el.getAttribute('data-code')).catch(() => null);
    if (!dataCode) {
        console.log(`Failed to extract game code from "${title}".`);
        return;
    }

    // First, try to extract FILE_URL
    const fileUrlMatch = dataCode.match(/FILE_URL\s*=\s*(?:"|')(.*?)(?:"|')/);
    let gameContent = null;

    if (fileUrlMatch) {
        const fileUrl = fileUrlMatch[1];
        console.log(`Extracted FILE_URL: ${fileUrl}`);

        try {
            const response = await fetch(fileUrl);
            if (response.ok) {
                const xmlData = await response.text();
                const parsedData = parser.parse(xmlData);
                gameContent = parsedData['Module']['Content'];
            } else {
                console.log("Failed to fetch game file.");
            }
        } catch (error) {
            console.log("Error fetching FILE_URL:", error);
        }
    }

    // If FILE_URL fails, try to extract gameHTML variable
    if (!gameContent) {
        const gameHTMLMatch = dataCode.match(/const\s+gameHTML\s*=\s*`([\s\S]*?)`/);
        if (gameHTMLMatch) {
            gameContent = gameHTMLMatch[1];
            console.log(`Extracted gameHTML for "${title}"`);
        } else {
            console.log("Failed to extract game content.");
            return;
        }
    }

    // Save the extracted content
    const filename = `${title.replace(/\s+/g, '_').toLowerCase()}.html`;
    const outputPath = path.join(__dirname, 'output', filename);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, gameContent, 'utf-8');
    console.log(`Game code saved to ${outputPath}`);

    // Existing save/intercept logic
    const test = await askQuestion("Would you like to fully save the game? (yes/no): ");
    if (test === 'yes') {
        const hostnames = fileUrlMatch 
            ? [new URL(fileUrlMatch[1]).hostname] 
            : [];
        const urls = fileUrlMatch 
            ? [fileUrlMatch[1]] 
            : [];

        await interceptRequests(`file://${outputPath}`, path.dirname(outputPath), true, hostnames, urls);
        
        // Adjust resource URLs if needed
        const adjustedContent = gameContent.replace(/(src|href|url)=["']([^"']+)["']/g, (match, p1, p2) => {
            return `${p1}="${encodeURI(p2)}"`;
        });
        
        fs.writeFileSync(outputPath, adjustedContent, 'utf-8');
        console.log(`Game saved to ${outputPath}`);
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
        links = [...new Set(links.filter(href => href.startsWith('http') || href.startsWith("https")))].slice(0, 5);
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
    const startUrl = process.argv[2] || "https://sites.google.com/view/drive-u-7-home/moto-x3m-4-winter";
    const browser = await puppeteer.launch({ headless: false });
    await processPage(browser, startUrl, true);
    await browser.close();
    rl.close();
})();
