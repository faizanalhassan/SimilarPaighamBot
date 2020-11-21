const puppeteer = require('puppeteer');
const exceptions = require('./exceptions');
const xpaths = require("./xpaths");
// import * as exceptions from './exceptions';
const logger = {
    info: msg => console.log(msg),
    error: (error, html, filename) => console.log(error, html, filename /* slugify filename also*/),
    debug: msg => console.log(msg),
    set_level: () => {},
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    CRITICAL: 5
};
logger.set_level(logger.DEBUG);

const fs = require('fs');
const IS_HEADLESS = false;
const MAX_LOAD_TIME = 30000; // We can get input this value
let browser;
let results = {successCount: 0, failedCount: 0};

function call_back_code(isSuccess) {
    if (isSuccess)
        results.successCount += 1;
    else
        results.failedCount += 1;
    console.table([results]);
}


let urls = fs.readFileSync('test-inputs.txt', {encoding: 'utf-8', flag: 'r'}).split('\r\n');
submitContactForms(urls, {
    name: "test name",
    email: "test@some-mail.com",
    subject: "Network",
    message: "Hi, how are you?"
}, call_back_code).then(()=>console.log('program end')).catch(e=>logger.error(e, "","program end" ));

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
            '--no-sandbox'
        ]
    });
    //page = await browser.newPage();

}

async function submitContactForms(formsUrls, values, callback) {
    await start_browser();
    // formsUrls = [];
    let page = (await browser.pages())[0];
    await handleCDPSession(page);
    for (const formsUrl of formsUrls) {
        let isSuccess = false;
        try{
            isSuccess = await submitContactForm(formsUrl, page, values);
        } catch (e) {
            if (e.name === "TimeoutError" || e.message.includes("ERR_CONNECTION_TIMED_OUT"))
            {
                logger.info("TimeoutError");
                // ignore
            }else {
                //let page_html = await page.evaluate(() => document.documentElement.outerHTML);
                let page_html = null;
                logger.error(e, page_html, formsUrl);
            }
        }
        logger.debug(`URL: ${formsUrl}, submit: ${isSuccess}`);
        callback(isSuccess); // callback is running for each form submission
    }
    logger.info("Job done closing browser");
    let pages = await browser.pages();
    for (const page of pages) {
        await page.close().catch(e => logger.error(e, 'Got Error closing pages'));
    }
    await browser.close().catch(e => logger.error(e, 'Got Error in closing browser'));
}

async function submitContactForm(formUrl, page, values) {
    await page.goto(formUrl, {timeout: MAX_LOAD_TIME});
    await page.mainFrame().waitForSelector("form", {timeout: 10000});
    let form = await find_element_by_xpaths(xpaths.form, page);
    if(await isFormSubmitSuccess(form))
    {
        throw new exceptions.SubmitSuccessBeforeFormSubmission;
    }

    for (const field_name of ["name", "email", "subject", "message"]) {
        if (!(await tryFillingInputUsingXpaths(form, values[field_name], xpaths[field_name]))) {
            return false;
        }
    }
    // let submit_element = (await form.$x(xpaths.submit[0]))[0];
    let submit_element = await find_element_by_xpaths(xpaths.submit, form);
    // logger.debug(`submit elements: ${(await form.$x(xpaths.submit[0])).length}`);
    await form.evaluate((frm, input) => input.click(), submit_element);
    await page.waitForTimeout(2000);
    await page.mainFrame().waitForSelector("form", {timeout: 10000});
    form = await find_element_by_xpaths(xpaths.form, page);
    if(await isFormSubmitSuccess(form)){
        return true;
    }
    return false;

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

async function find_element_by_xpaths(xpaths, parent) {
    for (const xpath of xpaths) {
        let elements = await parent.$x(xpath);
        if(elements.length){
            return elements[0];
        }
    }
    throw new exceptions.NoSuchElementFound

}
async function isFormSubmitError(form){
    try {
        return  await find_element_by_xpaths(xpaths.submitErrors, form);
    }catch (e) {
        if(!(e instanceof exceptions.NoSuchElementFound)){
            throw e;
        }
    }
    return false;
}

async function isFormSubmitSuccess(form){
    try {
        return  await find_element_by_xpaths(xpaths.submitSuccess, form);
    }catch (e) {
        if(!(e instanceof exceptions.NoSuchElementFound)){
            throw e;
        }
    }
    return false;
}