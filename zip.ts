import JSZip from "jszip";
import fs from "fs";
import path from "path";

const zipFilePath = process.argv[2];
const normalPath = path.join(__dirname, zipFilePath);
const zipPath = path.join(__dirname, 'zips', `${path.basename(zipFilePath)}.zip`);
async function addDirToZip(zip: JSZip, dirPath: string, zipPath: string = "") {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const entryZipPath = path.join(zipPath, entry.name);
        if (entry.isDirectory()) {
            await addDirToZip(zip, fullPath, entryZipPath);
        } else if (entry.isFile()) {
            const data = fs.readFileSync(fullPath);
            zip.file(entryZipPath, data);
        }
    }
}

async function main() {
    const zip = new JSZip();
    await addDirToZip(zip, normalPath);
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }
    if (!fs.existsSync(path.join(__dirname, 'zips'))) {
        fs.mkdirSync(path.join(__dirname, 'zips'));
    }
    const content = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(zipPath, content);
    console.log(`Created zip at ${zipPath}`);
};

main().catch(err => {
    console.error("Error:", err);
});
