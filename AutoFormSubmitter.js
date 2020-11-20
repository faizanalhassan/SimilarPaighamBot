const puppeteer = require('puppeteer');

const logger = {
    info: msg => console.log(msg),
    error: error => console.log(error),
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
let browser;
let results = {successCount: 0, failedCount: 0};

function call_back_code(isSuccess) {
    if (isSuccess)
        results.successCount += 1;
    else
        results.failedCount += 1;
    console.table([results]);
}

const xpaths = {
    form: ["//form[contains(@action, 'contact') or @action='']"],
    name: ["//input[contains(@name, 'name') and not(@name='username')]"],
    email: ["//input[contains(@name, 'email')]"],
    subject: ["//input[contains(@name, 'subject')]"],
    message: ["//textarea[contains(@name, 'message')]"],
    submit: ["//input[@type='submit']"]
}
let urls = fs.readFileSync('test-inputs.txt', {encoding: 'utf-8', flag: 'r'}).split('\r\n');
submitContactForms(urls, {
    name: "test name",
    email: "test@some-mail.com",
    subject: "Network",
    message: "Hi, how are you?"
}, call_back_code);

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
        }catch (e) {
            logger.error(e);
        }
        logger.debug(`Form submit: ${isSuccess}`);
        callback(isSuccess); // callback is running for each form submission
    }
    logger.info("Job done closing browser");
    await browser.close()

}

async function submitContactForm(formUrl, page, values) {
    try {
        await page.goto(formUrl);
    } catch (e) {
        return false;
    }
    let form;
    try {
        form = (await page.$x(xpaths.form[0]))[0]; // it needs to iterate with all xpaths until not fetch exact form
    } catch (e) {
        return false;
    }
    for (const field_name of ["name", "email", "subject", "message"]) {
        if (!(await tryFillingInputUsingXpaths(form, values[field_name], xpaths[field_name]))) {
            return false;
        }
    }

    await form.evaluate((frm, input) => input.click())
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
    let result = true, input_element;
    try {
        input_element = (await form.$x(xpath))[0];
    } catch (e) {
        return false;
    }
    await form.evaluate((frm, input, val) => input.value = val, input_element, value).catch(e => result = false);
    return result;
}
