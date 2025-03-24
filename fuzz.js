const baseURL = "https://littlealchemy2.com/static/icons/";
const fs = require("fs");

function getIconURL(number) {
    return baseURL + number + ".svg";
}

(async () => {
    let number = 0;
    while (number < 721) {
        fetch(getIconURL(number)).then(handleRes);
        console.log("REGISTERING: " + getIconURL(number));
        number++;
    }
})()
function handleRes(res) {
    // save to "output/LittleAlchemy2/static/icons/"
    const url = res.url;
    const number = url.split("/").pop().split(".")[0];
    res.text().then((text) => {
        const path = `output/static/icons/${number}.svg`;
        fs.writeFile(path, text, (err)=>{
            if (err) {
                console.log(err);
            } else {
                console.log("SAVED: " + path);
            }
        });
    });
}