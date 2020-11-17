const puppeteer = require('puppeteer');

const fs = require('fs');
const HEADLESS = false;
let browser;
let results = {successCount: 0, failedCount: 0};
const xpaths = {
    name: ["//input[contains(@name, 'name') and not(@name='username')]"],
    email: ["//input[contains(@name, 'email')]"],
    subject: ["//input[contains(@name, 'subject')]"],
    message: ["//textarea[contains(@name, 'message')]"]
}

async function start_browser() {
    browser = await puppeteer.launch({
        headless: HEADLESS,
        defaultViewport: null,
        args: ['--disable-web-security',
            '--allow-running-insecure-content',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox'
        ]
    });
    //page = await browser.newPage();

}

async function handleCDPSession(page) {
    let session = await page.target().createCDPSession();
    await session.send("Page.enable");
    await session.send("Page.setWebLifecycleState", {state: "active"});
}

async function setInputValue(form, xpath, value) {
    let result = true, input_element;
    try{
        input_element = (await form.$x(xpath))[0];
    }catch (e) {
        return false;
    }
    await form.evaluate((frm, input, val) => input.value = val, input_element, value).catch(e => result = false);
    return result;
}

async function tryFillingInputUsingXpaths(form, value, field_xpaths) {
    for (const xpath of field_xpaths) {
        if (await setInputValue(form, xpath, value)) {
            return true;
        }
    }
    return false;
}

async function autoSubmitContactForm(formUrl, page, values) {
    let load_error = false;
    await page.goto(formUrl).catch(() => load_error=true);
    if (load_error)
        return false;
    let form;
    try {
        form = (await page.$x("//form[contains(@action, 'contact') or @action='']"))[0];
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
function show_results(){
    console.table([results]);
}
async function autoSubmitContactForms(formsUrls, values, callback) {
    await start_browser();
    // formsUrls = [];
    let page = (await browser.pages())[0];
    await handleCDPSession(page);
    const responses = new Map();
    page.on('response', response => responses.set(response.url, response));
    page.on('load', () => {
        const mainResource = responses.get(page.url());
        console.log('Main resource status: ' + mainResource.status);
    });
    for (const formsUrl of formsUrls) {
        let isSuccess = await autoSubmitContactForm(formsUrl, page, values);
        callback(isSuccess);
    }
    await browser.close()

}

let urls = fs.readFileSync('test-inputs.txt', {encoding: 'utf-8', flag: 'r'}).split('\r\n');
autoSubmitContactForms(urls, {
    name: "test name",
    email: "test@some-mail.com",
    subject: "Network",
    message: "Hi, how are you?"
}, (isSuccess)=>{
    if(isSuccess)
        results.successCount += 1;
    else
        results.failedCount += 1;
    show_results()
});

