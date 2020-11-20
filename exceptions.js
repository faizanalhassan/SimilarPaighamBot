function customException(name) {
    module.exports[name] = function (message) {
        this.name = name;
        if(message){
            this.message = message;
        }
    }

}
customException("NoSuchElementFound");
customException("SubmitErrorsBeforeFormSubmission");
customException("SubmitErrorsAfterSubmit")