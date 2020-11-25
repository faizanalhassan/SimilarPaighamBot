const puppeteer = require('puppeteer');
const exceptions = require('./exceptions');
const xpaths = require("./xpaths");
const fs = require('fs');
const logger = require("./logger");

const IS_HEADLESS = false;
const MAX_TABS = 4;
const urls_json = process.argv[2];
const processName = `Process${process.argv[4]}`;
logger.setProcessName(processName);
const MAX_LOAD_TIME = parseInt(process.argv[3]); // We can get input this value
const MAX_TIME_FOR_PAGE = parseInt(process.argv[5]); // We can get input this value
const IS_TESTING = process.argv[6] === "test";
const pageNotWorkingExamples = fs.readFileSync('page-not-working.txt', {encoding: 'utf-8', flag: 'r'})
    .toLowerCase()
    .trim()
    .split(/\r\n|\r|\n/);

let browser;
let results = {successCount: 0, failedCount: 0};

// logger.debug(["arg_value:", arg_value]);
// const urls = JSON.parse(urls_json);
const urls = fs.readFileSync('test-inputs.txt', {encoding: 'utf-8', flag: 'r'}).trim().split('\r\n');
logger.info(`MAX_LOAD_TIME: ${MAX_LOAD_TIME}, MAX_TIME_FOR_PAGE: ${MAX_TIME_FOR_PAGE}, URLs received: ${urls.length}`);

async function safeExit(){
    let pages = await browser.pages();
    for (const page of pages) {
        await page.close().catch(e => logger.debug(`${e} Got Error on closing pages in safe exit`));
    }
    await browser.close().catch(e => logger.debug(`${e} Got Error on closing browser in safe exit`));
    logger.info('program exiting')
    process.exit();
}
async function call_back_code(isSuccess) {
    let objToSend;
    if (isSuccess) {
        results.successCount += 1;
        // client.send();
        objToSend = {successCount: 1, failedCount: 0}
    } else {
        results.failedCount += 1;
        // client.send();
        objToSend = {successCount: 0, failedCount: 1};
    }
    try{
        if(!IS_TESTING)
            process.send(objToSend);
        else
            logger.info(`objTosend:${JSON.stringify(objToSend)}, `)
    }
    catch(ex){
        // This will come once parent dies.
        // One way can be to check for error code ERR_IPC_CHANNEL_CLOSED
        //     and call process.exit()
        logger.info('parent died', ex.toString());
        await safeExit();
        // process.exit()
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
}, call_back_code)
    .catch(e => logger.error(e, "", "at program end"))
    .finally(async ()=>{await safeExit();});

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
            '--blink-settings=imagesEnabled=false'
            // '--user-data-dir=puppeteer-data'
        ],
        ignoreHTTPSErrors: true
    });
    //page = await browser.newPage();

}

async function submitContactForms(formsUrls, values, callback) {
    await start_browser();
    let ignoreExceptions = ["TimeoutError", "CaptchaFound", "PageLoadError", "NoSuchElementFound",
        "FormNotExists", "FormHasQuiz", "FormTryAgainError"];
    // formsUrls = [];
    // let page = (await browser.pages())[0];

    for (const formsUrl of formsUrls) {
        let page = await browser.newPage();
        // await page.setRequestInterception(true);
        // page.on('request', (req) => {
        //     if(req.resourceType() === 'stylesheet' || req.resourceType() === 'font' || req.resourceType() === 'image'){
        //         req.abort().catch(e=>logger.info(`Error on page.on('request'): ${e}`));
        //     }
        //     else {
        //         req.continue();
        //     }
        // })
        // await handleCDPSession(page);
        let isSuccess = false;
        let info_msg = `URL: ${formsUrl}`;
        try {
            isSuccess = await submitContactForm(formsUrl, page, values);
        } catch (e) {
            if (ignoreExceptions.some(v => v === e.name)) {
                info_msg += `, Reason: ${JSON.stringify(e.message)}`;
            } else {
                info_msg += `, Description: Details are saved to error logs, please send error logs to us.`;
                let page_html = await page.evaluate(() => document.documentElement.outerHTML).catch(e=>e);
                // let page_html = null;
                logger.error(e, page_html, formsUrl);
            }
        } finally {
            page.close()
                .catch(e => logger.debug(`Got Error closing page: ${e}' in finally.`));
        }
        //logger.debug(`URL: ${formsUrl}, submit: ${isSuccess}`);
        logger.info(`Submit: ${isSuccess}, ` + info_msg)
        callback(isSuccess); // callback is running for each form submission
    }
    logger.info("Job done.");

    // client.emit('end');
    // client.close();

}

async function submitContactForm(formUrl, page, values) {
    let done = false;
    setTimeout(() => {
        if (!done) {
            let msg = `Form ${formUrl} took more time than MAX_TIME_FOR_PAGE: ${MAX_TIME_FOR_PAGE}.`;
            logger.info(msg);
            page.close()
                .catch(e => logger.debug(`Got Error '${e}' on closing page on timeout`));
            // reject(new exceptions.PageLoadError(msg));
        }
    }, MAX_TIME_FOR_PAGE);
    try {
        return await _submitContactForm(formUrl, page, values);
    }catch (e) {
        // logger.info(e);
        if(e.message.includes("Protocol error")){
            return false;
        }
        throw e;
    } finally {
        done = true;
    }

}

async function _submitContactForm(formUrl, page, values) {
    let exception = null;
    try {
        await page.goto(formUrl, {timeout: MAX_LOAD_TIME});
    } catch (e) {
        exception = e;
        await page.waitForTimeout(1000);

    }
    let retryCount = 0;
    let page_text = '';
    while(true) {
        try {
            page_text = (await page.evaluate(() => document.documentElement.innerText)).toLowerCase();
            break;
        }catch (e) {
            if(retryCount < 3){
                retryCount++;
                await delay(1000);
            }else{
                throw e;
            }
        }
    }
    if(pageNotWorkingExamples.some(v=>page_text.includes(v)) ){
        throw new exceptions.PageLoadError;
    }
    let element = await getIfElementExists(xpaths.pageLoadError, page, 5, 2);
    let page_title = (await page.title()).toLowerCase();
    if (element || ["Service Temporarily Unavailable", "403 forbidden", "page not found", "404 not found"]
        .some(v=> page_title.includes(v.toLowerCase()))) {
        // exc.message = await element.evaluate(node => node.innerText);
        throw new exceptions.PageLoadError;
    } else if (exception && !(['ERR_NETWORK_CHANGED', 'ERR_CONNECTION_TIMED_OUT'].some(v=>exception.message.includes(v)) || exception.name === "TimeoutError")) {
        throw exception;
    }
    try {
        await page.mainFrame().waitForSelector("form", {timeout: 20000});
    }catch (e) {
        if(e.name==="TimeoutError"){
            throw new exceptions.FormNotExists;
        }
    }
    let form = await findElementByXpaths(xpaths.form, page, 3, 5, 1000);
    if (await getIfElementExists(xpaths.captcha, form)) {
        throw new exceptions.CaptchaFound;
    }
    if (await getIfElementExists(xpaths.quiz, form)) {
        throw new exceptions.FormHasQuiz;
    }
    if (await isFormSubmitSuccess(form)) {
        throw new exceptions.SubmitSuccessBeforeFormSubmission;
    }

    for (const field_name of ["name", "email", "message"]) {
        if (!(await tryFillingInputUsingXpaths(form, values[field_name], xpaths[field_name]))) {
            return false;
        }
    }
    await tryFillingInputUsingXpaths(form, values["subject"], xpaths["subject"])
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
    let submitCount = 0;
    for (let i = 0; i < 7; i++) {
        logger.debug([i, 'submit check']);
        await page.waitForTimeout(2000);
        // await page.mainFrame().waitForSelector("form", {timeout: 10000});
        form = await findElementByXpaths(xpaths.form, page, 3, 5, 2000);
        if(await getIfElementExists(xpaths.submitLoading, form)){
            await page.waitForTimeout(2000);
        }
        let submitStatusE;
        if ((submitStatusE = await getIfElementExists(xpaths.submitErrors, form))) {
            if(submitCount>=3){
                throw new exceptions.FormTryAgainError;
            }
            let msg = await submitStatusE.evaluate(node => node.innerText.toLowerCase());
            if (msg.includes("there was an error trying to send your message. please try again later.")
                || msg.includes("please try later")) {
                logger.info('trying again msg');
                await delay(3000);
                let submitElement = await findElementByXpaths(xpaths.submit, form);
                await submitElement.click();
                submitCount++;
                i = 0;
                continue
            }
            throw new exceptions.SubmitErrorsAfterSubmit(msg);
        } else if (await getIfElementExists(xpaths.submitSuccess, form)) {
            return true;
        } else if(i%2===0){
            let submitElement = await findElementByXpaths(xpaths.submit, form);
            await submitElement.click();
            // submitCount++;
        }
    }
    if(submitCount>1){
        throw new exceptions.FormTryAgainError;
    }
    throw new exceptions.SubmitNeitherSuccessNorError;

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
        input_element = await findElementByXpaths([xpath], form);
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
                if(e.message === "Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed."){
                    throw e;
                }
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

async function getIfElementExists(xpaths, parent, maxTriesOnExc = 1, maxTriesAll=0, delayValue = 0) {
    try {
        return await findElementByXpaths(xpaths, parent, maxTriesOnExc, maxTriesAll, delayValue);
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