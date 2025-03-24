const fs = require('fs');

const dirToFix = process.argv[2];
const fixExt = '';

if (!dirToFix) {
    console.error('Usage: node fixextentions.js <dirToFix>');
    process.exit(1);
}

fs.readdir(dirToFix, (err, files) => {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }

    files.forEach((file) => {
        const filePath = `${dirToFix}/${file}`;
        fs.rename(filePath, `${filePath.split('.')[0]}`, (err) => {
            if (err) {
                console.error(err.message);
            }
        });
    });
});