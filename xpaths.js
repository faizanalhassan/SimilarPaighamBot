const xpaths = {
    noForm: ["//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'this form is currently undergoing maintenance. please try again later')]"],
    form: ["//form[contains(@action, 'contact') or contains(@action, '#wpcf7') or @action='' or contains(@class, 'wpcf7') or @class='elementor-form']"],
    name: [".//input[contains(@name, 'name') and not(@name='username')]"],
    email: [".//input[contains(@name, 'email')]"],
    subject: [".//input[contains(@name, 'subject')]"],
    message: [".//textarea[contains(@name, 'message')]"],
    submit: [".//input[@type='submit']", ".//button"],
    submitLoading: [".//*[@class='fusion-slider-loading' and contains(@style, 'display: block;')]"],
    submitErrors: [".//*[contains(translate(., 'VE', 've'), 'validation errors') or contains(., 'an error') or contains(translate(., 'FS', 'fs'), 'failed to send')]"],
    submitSuccess: [".//*[contains(translate(., 'T', 't'), 'thank') or contains(translate(., 'S', 's'), 'success')]"],
    captcha: [".//*[contains(@src, 'captcha') or contains(@href, 'captcha') and (name()='img' or name()='a')]"],
    pageLoadError: ["//div[@id='main-message' and contains(., 'This site can’t be reached')]", "//h1[.='403 Forbidden']",
        "//div[contains(@class, 'error') and contains(translate(., 'PAGE NOT FOUND', 'page not found'), 'page not found')]",
        "//html[.//*[@class='status-code' and text()='404'] and .//*[text()='Not Found']]"],
    quiz: ["//span[contains(@class, 'wpcf7-quiz-label')]"]
}
module.exports = xpaths;