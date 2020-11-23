function customException(name, message) {
    function exception(extra) {
        this.name = name;
        this.message = message + " " + (extra || '');

        if ("captureStackTrace" in Error)
            Error.captureStackTrace(this, exception);
        else
            this.stack = (new Error()).stack;
    }
    exception.prototype = Object.create(Error.prototype);
    exception.prototype.name = name;
    exception.prototype.constructor = exception;
    module.exports[name] = exception;

}
customException("NoSuchElementFound", "Probably your internet connection is not working well. Element not found with any of given xpaths");
customException("SubmitErrorsBeforeFormSubmission", "Submit error xpaths must not match before form submission");
customException("SubmitErrorsAfterSubmit", "Form might not successfully submitted.");
customException("SubmitSuccessBeforeFormSubmission", "Submit success xpaths must not match before form submission");
customException("CaptchaFound", "This url contains captcha");
customException("SubmitNeitherSuccessNorError", "Could not find Submit success or error");
customException("PageLoadError", "This page is not working correctly.");
customException("FormNotExists", "This page does not have contact form.");
