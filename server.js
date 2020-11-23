// const io = require("socket.io");
const fork = require('child_process').fork;
// const server = io(3210, { pingInterval: 2000 });
const logger = require('./logger')
const TOTAL_PROCESSES = 1;
const fs = require('fs');
const constants = require('./constants');
if(fs.existsSync(constants.INFO_FILE_NAME)) {
    fs.unlinkSync(constants.INFO_FILE_NAME);
}
const URLs = fs.readFileSync('test-inputs.txt', {encoding: 'utf-8', flag: 'r'}).trim().split('\r\n');
const SUB_URLs_LEN = Math.round(URLs.length/TOTAL_PROCESSES);
let process_count = 1, i, j, sub_urls, pEndCount = 0, failedCount = 0, successCount = 0;
for(i = 0, j= 0; i < TOTAL_PROCESSES-1; i++, j+=SUB_URLs_LEN, process_count++){
    sub_urls = URLs.slice(j, SUB_URLs_LEN*process_count);
    run_process(sub_urls, j+1);
    // console.log(sub_urls, i, j, process_count);
}
sub_urls = URLs.slice(j);
run_process(sub_urls, j+1);
// server.on("connection", function(socket) {
//     // simple test
//     //console.log('connection', arguments);
//     socket.on("end", function () {
//         console.log('end', arguments);
//         pEndCount++;
//         if(pEndCount>=process_count){
//             console.log('Closing server');
//             server.close();
//             process.exit()
//         }
//         //socket.emit("hi");
//     });
//     socket.on("message", function () {
//         // console.log('message', arguments);
//         //socket.emit("message");
//         // console.log(JSON.stringify(arguments));
//         failedCount += arguments[0].failedCount;
//         successCount += arguments[0].successCount;
//         console.table({successCount:successCount, failedCount: failedCount});
//     });
//     // server.send("hello");
// });
function run_process(urls, p) {
    let is_terminated = false;
    const p_timeout = urls.length * constants.MAX_TIME_FOR_PAGE;
    // const p_timeout = 10000;
    logger.info(`Starting process${p} with timeout ${p_timeout}`);
    let child = fork('./AutoFormSubmitter', [JSON.stringify(urls), constants.MAX_TIME_FOR_PAGE, p, constants.MAX_TIME_FOR_PAGE]);
    function on_close_exit(code, signal){
        if(!is_terminated) {
            is_terminated = true
            logger.info(`Process${p} terminated with code ${code} and signal ${signal}.`);
            pEndCount++;
            if(pEndCount>=process_count){
                console.log('Closing server');
                // server.close();
                // process.abort();
                process.exit();
            }
        }else {
            logger.info(`Process${p} is already terminated, received code ${code} and signal ${signal} again.`);
        }
    }
    child.on('close', on_close_exit);
    child.on('exit', on_close_exit);
    let startTime = (new Date()).getTime();
    setTimeout(()=>{
        let endTime = (new Date()).getTime();
        let timeSpent = endTime - startTime;
        logger.info(`Time spent ${timeSpent}, isTimeout: ${timeSpent>=p_timeout}`);
        if(!is_terminated){
            logger.info(`Trying to kill process${p}.`);
            child.kill('SIGINT');
        }else{
            logger.info(`No need timeout as process${p} was already terminated.`)
        }
    }, p_timeout);
    child.on("message", function () {
        // console.log('message', arguments);
        //socket.emit("message");
        // console.log(JSON.stringify(arguments));
        failedCount += arguments[0].failedCount;
        successCount += arguments[0].successCount;
        console.table({successCount:successCount, failedCount: failedCount});
    });

    // child.stdin.on('data', function(data) {
    //     console.log(data);
    // });
}