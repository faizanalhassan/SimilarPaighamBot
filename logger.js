const fs = require('fs');
const slugify = require('slugify');
const constants = require('./constants');
let processName = "ParentProcess";
let IS_DEBUG = false;
slugify.extend({':': '_'})
slugify.extend({'.': '_'})
if (!fs.existsSync(constants.ERROR_LOG_DIR)) {
    fs.mkdirSync(constants.ERROR_LOG_DIR);
}
if (!fs.existsSync(constants.INFO_LOG_DIR)) {
    fs.mkdirSync(constants.INFO_LOG_DIR);
}

function writeError(exception, html, url) {
    let data = `${(new Date()).toJSON()}\n\n Process:${processName} \n\n exception msg: ${exception.message} \n\n`
        +`exception stringify: ${JSON.stringify(exception)}\n\n exception stack: ${exception.stack}\n\n html: ${html}`;
    let fileName = slugify(url, {strict: true, lower: true});
    fs.writeFile(`${constants.ERROR_LOG_DIR}/${fileName}.log`, data, {flag: "w"}, function (err) {
        if (err) throw err;

    });
    // console.log(data);
}

function writeInfo(msg) {
    // let date_ob = new Date();
    let data = `${processName} INFO ${(new Date()).toJSON()} ${msg}\n`;
    fs.writeFile(`${constants.INFO_FILE_NAME}`, data, {flag: "a"}, function (err) {
        if (err) throw err;

    });
    console.log(data);
}
function setProcessName(name){
    processName = name;
}
// writeError({aman: "test"}, "html", "https://google.com/aman");
// writeInfo({aman: "test"}, "html", "https://google.com/aman");
module.exports.error = writeError;
module.exports.info = writeInfo;
module.exports.debug = (msg) => {
    if (IS_DEBUG) {
        console.log(`${processName} DEBUG ${(new Date()).toJSON()} ${msg}\n`)
    }
    // writeInfo(msg);
};
module.exports.setProcessName = setProcessName;