const xpaths = {
    form: ["//form[contains(@action, 'contact') or @action='']"],
    name: [".//input[contains(@name, 'name') and not(@name='username')]"],
    email: [".//input[contains(@name, 'email')]"],
    subject: [".//input[contains(@name, 'subject')]"],
    message: [".//textarea[contains(@name, 'message')]"],
    submit: [".//input[@type='submit']"],
    submitErrors: [".//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'validation errors') or contains(., 'an error')]"],
    submitSuccess: ["//form//*[contains(translate(., 'T', 't'), 'thank') or contains(translate(., 'S', 's'), 'success')]"]
}
module.exports = xpaths;