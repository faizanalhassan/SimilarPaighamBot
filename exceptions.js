function customException(name, message) {
    function exception() {
        this.name = name;
        this.message = message;

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
customException("NoSuchElementFound", "Element not found with any of given xpaths");
customException("SubmitErrorsBeforeFormSubmission", "Submit error xpaths must not match before form submission");
customException("SubmitErrorsAfterSubmit", "Form might not successfully submitted.");
customException("SubmitSuccessBeforeFormSubmission", "Submit success xpaths must not match before form submission");