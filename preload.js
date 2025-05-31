const server = require('./server.js');

// window.customApis = {
//     readFile: (path) => {
//       return fs.readFileSync(path, "utf8");
//     },
//   };

// window.customApis1 = {
//   onReady() {
//     // 启动服务时添加日志输出
//     console.log('正在启动后台服务...');
//     server();
//   }
// }


window.ysok = {
    name () {
        return "ysok";
    },
    server,
    openFolder: (path) => {
        require('child_process').exec(`start "" "${path}"`);
    }
}