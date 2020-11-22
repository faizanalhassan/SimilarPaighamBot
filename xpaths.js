const xpaths = {
    form: ["//form[contains(@action, 'contact') or contains(@action, '#wpcf7') or @action='' or contains(@class, 'wpcf7')]"],
    name: [".//input[contains(@name, 'name') and not(@name='username')]"],
    email: [".//input[contains(@name, 'email')]"],
    subject: [".//input[contains(@name, 'subject')]"],
    message: [".//textarea[contains(@name, 'message')]"],
    submit: [".//input[@type='submit']"],
    submitErrors: [".//*[contains(translate(., 'VE', 've'), 'validation errors') or contains(., 'an error')]"],
    submitSuccess: [".//*[contains(translate(., 'T', 't'), 'thank') or contains(translate(., 'S', 's'), 'success')]"],
    captcha: [".//*[contains(@src, 'captcha') or contains(@href, 'captcha') and (name()='img' or name()='a')]"],
    pageLoadError: ["//div[@id='main-message' and contains(., 'This site can’t be reached')]", "//h1[.='403 Forbidden']"
        ,"//div[contains(@class, 'error') and contains(translate(., 'PAGE NOT FOUND', 'page not found'), 'page not found')]"]
}
module.exports = xpaths;