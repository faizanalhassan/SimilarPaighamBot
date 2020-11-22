exports.ERROR_LOG_DIR = "error_logs";
exports.INFO_LOG_DIR = "info_logs";
exports.INFO_FILE_NAME = `${exports.INFO_LOG_DIR}/info.log`;
exports.SECONDS = 1000;
exports.MINUTE = 60 * exports.SECONDS;
exports.MAX_TIME_FOR_PAGE = 2 * exports.MINUTE; // can get through user
exports.MAX_TIME_FOR_LOAD = 30 * exports.SECONDS; // can get through user