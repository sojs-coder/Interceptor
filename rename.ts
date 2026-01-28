import { readdir, rename } from "fs/promises";
import { join, extname, basename, dirname } from "path";

// Parse CLI arguments
const args = Object.fromEntries(
    process.argv.slice(2).map(arg => {
        const [key, value] = arg.replace(/^--/, '').split('=');
        return [key, value];
    })
);


const folder = args.folder;
const replaceStr = args.replace;
const withStr = args.with;
const changeNamesIn = args.changeNamesIn ? args.changeNamesIn.split(',') : [];

if (!folder || !replaceStr || !withStr) {
    console.error("Usage: bun run rename.ts --folder=some/dir --replace=png --with=jpg [--changeNamesIn=data.json,foo.js]");
    process.exit(1);
}

import { readFile, writeFile } from "fs/promises";


async function updateReferences(oldPath: string, newPath: string) {
    // oldPath and newPath are absolute
    // We want to replace references to the old path (relative to folder) with the new path
    const relOld = (oldPath.startsWith(folder) ? oldPath.slice(folder.length).replace(/^\\|\//, "") : oldPath).split('\\').pop(); // Get just the filename
    const relNew = (newPath.startsWith(folder) ? newPath.slice(folder.length).replace(/^\\|\//, "") : newPath).split('\\').pop(); // Get just the filename
    for (const file of changeNamesIn) {
        try {
            const filePath = join(process.cwd(), file);
            let content = await readFile(filePath, "utf8");
            if (relOld && relNew) {
                content = content.replaceAll(relOld, relNew)
            }
            await writeFile(filePath, content, "utf8");
            console.log(`Updated references in: ${file} (${relOld} -> ${relNew})`);
        } catch (e) {
            console.error(`Failed to update references in ${file}:`, e);
        }
    }
}

async function renameFiles(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            await renameFiles(fullPath);
        } else if (entry.isFile()) {
            if (entry.name.includes(replaceStr)) {
                const newName = entry.name.replace(replaceStr, withStr);
                const newPath = join(dir, newName);
                await rename(fullPath, newPath);
                console.log(`Renamed: ${fullPath} -> ${newPath}`);
                if (changeNamesIn.length > 0) {
                    await updateReferences(fullPath, newPath);
                }
            }
        }
    }
}

renameFiles(folder).catch(err => {
    console.error("Error:", err);
    process.exit(1);
});