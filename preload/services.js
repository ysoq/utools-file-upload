console.log('开始加载preload')

const server = require('../server.js');

window.ysok = {
    name () {
        return "ysok";
    },
    server,
    openFolder: (path) => {
        require('child_process').exec(`start "" "${path}"`);
    }
}

console.log('加载preload完成')