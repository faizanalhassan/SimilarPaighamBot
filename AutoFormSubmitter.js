const puppeteer = require('puppeteer');
const exceptions = require('./exceptions');
const xpaths = require("./xpaths");
const client = require("./client").client;
const logger = require("./logger");

// const logger = {
//     info: msg => console.log(msg),
//     error: (error, html, filename) => console.log(error, html, filename /* slugify filename also*/),
//     debug: msg => {
//     }/*console.log(msg)*/,
//     set_level: () => {
//     },
//     DEBUG: 1,
//     INFO: 2,
//     WARN: 3,
//     ERROR: 4,
//     CRITICAL: 5
// };
// logger.set_level(logger.DEBUG);

// const fs = require('fs');
const IS_HEADLESS = false;
const MAX_TABS = 4;
const processName = `Process${process.argv[4]}`;
logger.setProcessName(processName);
const MAX_LOAD_TIME = parseInt(process.argv[3]); // We can get input this value
logger.info(["MAX_LOAD_TIME:", MAX_LOAD_TIME]);
let browser;
let results = {successCount: 0, failedCount: 0};
let arg_value = process.argv[2];
// logger.debug(["arg_value:", arg_value]);
let urls = JSON.parse(arg_value);
logger.debug(`URLs: ${urls}`);


function call_back_code(isSuccess) {
    if (isSuccess) {
        results.successCount += 1;
        client.send({successCount: 1, failedCount: 0});
    } else {
        results.failedCount += 1;
        client.send({successCount: 0, failedCount: 1});
    }
    // client.send(results);
    // console.table([results]);

}


// let urls = fs.readFileSync('test-inputs.txt', {encoding: 'utf-8', flag: 'r'}).split('\r\n');

submitContactForms(urls, {
    name: "test name",
    email: "test@some-mail.com",
    subject: "Network",
    message: "Hi, how are you?"
}, call_back_code).then(() => console.log('program end')).catch(e => logger.error(e, "", "program end"));

async function handleCDPSession(page) {
    let session = await page.target().createCDPSession();
    await session.send("Page.enable");
    await session.send("Page.setWebLifecycleState", {state: "active"});
}

async function start_browser() {
    browser = await puppeteer.launch({
        headless: IS_HEADLESS,
        defaultViewport: null,
        args: ['--disable-web-security',
            '--allow-running-insecure-content',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            // '--user-data-dir=puppeteer-data'
        ]
    });
    //page = await browser.newPage();

}

async function submitContactForms(formsUrls, values, callback) {
    await start_browser();
    let ignoreExceptions = ["TimeoutError", "CaptchaFound", "PageLoadError", "NoSuchElementFound"];
    // formsUrls = [];
    // let page = (await browser.pages())[0];

    for (const formsUrl of formsUrls) {
        let page = await browser.newPage();
        await handleCDPSession(page);
        let isSuccess = false;
        let info_msg = `URL: ${formsUrl}`;
        try {
            isSuccess = await submitContactForm(formsUrl, page, values);
        } catch (e) {
            if (ignoreExceptions.some(v => v === e.name)) {
                info_msg += `, Reason: ${JSON.stringify(e.message)}`;
            } else {
                info_msg += `, Description: Details are saved to error logs, please send error logs to us.`;
                let page_html = await page.evaluate(() => document.documentElement.outerHTML);
                // let page_html = null;
                logger.error(e, page_html, formsUrl);
            }
        }
        //logger.debug(`URL: ${formsUrl}, submit: ${isSuccess}`);
        logger.info(`Submit: ${isSuccess}, ` + info_msg)
        callback(isSuccess); // callback is running for each form submission
    }
    logger.info("Job done closing browser");
    let pages = await browser.pages();
    for (const page of pages) {
        await page.close().catch(e => logger.error(e, 'Got Error closing pages', 'Error-while-page-closing'));
    }
    await browser.close().catch(e => logger.error(e, 'Got Error in closing browser', 'error while browser closing'));
    client.emit('end');
    client.close();
    process.exit()
}

async function submitContactForm(formUrl, page, values) {
    let done = false;
    return new Promise(function (resolve, reject) {
        setTimeout(() => {
            if (!done) {
                let msg = `Form ${formUrl} is taking too much time, may be internet issue.`;
                logger.debug(msg);
                page.close().catch(e => logger.error(e, 'Got Error closing pages', 'Error-while-page-closing on timeout'));
                reject(new exceptions.PageLoadError(msg));
            }
        }, 1000 * 60 * 2);
        _submitContactForm(formUrl, page, values)
            .then((v) => {
                resolve(v);
            })
            .catch((e) => {
                reject(e);
            })
            .finally(() => {
                done = true;
                page.close().catch(e => logger.error(e, 'Got Error closing pages', 'Error-while-page-closing on contactForm'));
            });
    });

}

async function _submitContactForm(formUrl, page, values) {
    let exception = null;
    try {
        await page.goto(formUrl, {timeout: MAX_LOAD_TIME});
    } catch (e) {
        exception = e;
        // if(e.message.includes("ERR_CONNECTION_TIMED_OUT")||e.name === "TimeoutError"){
        //     let element = await getIfElementExists(xpaths.pageLoadError, page, 5);
        //     if(element){
        //         let exception = new exceptions.PageLoadError;
        //         exception.message = await element.evaluate(node => node.innerText);
        //         throw exception;
        //     }
        // } else {
        //     throw e;
        // }
    }
    let element = await getIfElementExists(xpaths.pageLoadError, page, 5);
    if (element) {
        let exc = new exceptions.PageLoadError;
        exc.message = await element.evaluate(node => node.innerText);
        throw exc;
    } else if (exception && !(exception.message.includes("ERR_CONNECTION_TIMED_OUT") || exception.name === "TimeoutError")) {
        throw exception;
    }
    // await page.mainFrame().waitForSelector("form", {timeout: 20000});
    let form = await findElementByXpaths(xpaths.form, page, 3, 20, 2000);
    if (await getIfElementExists(xpaths.captcha, form)) {
        throw new exceptions.CaptchaFound;
    }
    if (await isFormSubmitSuccess(form)) {
        throw new exceptions.SubmitSuccessBeforeFormSubmission;
    }

    for (const field_name of ["name", "email", "subject", "message"]) {
        if (!(await tryFillingInputUsingXpaths(form, values[field_name], xpaths[field_name]))) {
            return false;
        }
    }
    // let submit_element = (await form.$x(xpaths.submit[0]))[0];
    let submitElement = await findElementByXpaths(xpaths.submit, form);
    // logger.debug(`submit elements: ${(await form.$x(xpaths.submit[0])).length}`);
    // await form.evaluate((frm, input) => input.click(), submitElement);
    // let boxContent = (await submitElement.boxModel()).content;
    // console.log(boxContent);
    // let x = (boxContent[0].x + boxContent[1].x)/2, y =(boxContent[1].y+boxContent[2].y)/2
    // await page.mouse.move(x, y, {steps: 5});
    // await page.mouse.click(x, y, {delay: 100})
    await submitElement.click()

    for (let i = 0; i < 5; i++) {
        logger.debug([i, 'submit check']);
        await page.waitForTimeout(1000);
        // await page.mainFrame().waitForSelector("form", {timeout: 10000});
        form = await findElementByXpaths(xpaths.form, page, 3, 10, 2000);
        let submitStatusE;
        if ((submitStatusE = await getIfElementExists(xpaths.submitErrors, form))) {
            let msg = await submitStatusE.evaluate(node => node.innerText);
            if (msg === "There was an error trying to send your message. Please try again later.") {
                logger.info('trying again msg');
                await delay(3000);
                let submitElement = await findElementByXpaths(xpaths.submit, form);
                await submitElement.click();
                continue
            }
            throw new exceptions.SubmitErrorsAfterSubmit(msg);
        } else if (await getIfElementExists(xpaths.submitSuccess, form)) {
            return true;
        }
    }
    throw new exceptions.SubmitSuccessErrorNotFound;

}

async function tryFillingInputUsingXpaths(form, value, field_xpaths) {
    for (const xpath of field_xpaths) {
        if (await setInputValue(form, xpath, value)) {
            return true;
        }
    }
    return false;
}

async function setInputValue(form, xpath, value) {
    let input_element;
    try {
        input_element = (await form.$x(xpath))[0];
    } catch (e) {
        return false;
    }
    await form.evaluate((frm, input, val) => input.value = val, input_element, value);
    return true;
}

async function findElementByXpaths(xpaths, parent, maxTriesOnExc = 1, maxTriesAll = 0, delayValue = 1000) {
    let exception = null;
    for (const xpath of xpaths) {
        let elements = null;
        let i = 0;
        while (i < maxTriesOnExc || maxTriesAll > 0) {
            try {
                logger.debug([i, maxTriesAll, xpath]);
                elements = await parent.$x(xpath);
                exception = null;
                if (maxTriesAll && !elements.length) {

                    await delay(delayValue);
                } else
                    break
            } catch (e) {
                exception = e;
                logger.debug(e.message);
            }
            // await delay(delayValue);
            i++;
            maxTriesAll--;
        }

        if (elements && elements.length) {
            return elements[0];
        }
    }
    // console.log(JSON.stringify(exception));
    throw exception || new exceptions.NoSuchElementFound(JSON.stringify(xpaths))

}

async function isFormSubmitError(form) {
    try {
        return await findElementByXpaths(xpaths.submitErrors, form);
    } catch (e) {
        if (!(e instanceof exceptions.NoSuchElementFound)) {
            throw e;
        }
    }
    return false;
}

async function isFormSubmitSuccess(form) {
    try {
        return await findElementByXpaths(xpaths.submitSuccess, form);
    } catch (e) {
        if (!(e instanceof exceptions.NoSuchElementFound)) {
            throw e;
        }
    }
    return false;
}

async function getIfElementExists(xpaths, parent, maxTriesOnExc = 1, delayValue = 0) {
    try {
        return await findElementByXpaths(xpaths, parent, maxTriesOnExc, delayValue);
    } catch (e) {
        if (!(e instanceof exceptions.NoSuchElementFound)) {
            throw e;
        }
        return false;
    }

}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}