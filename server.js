const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const app = express();

// 创建上传目录
const UPLOAD_DIR = 'C://anytime';
!fs.existsSync(UPLOAD_DIR) && fs.mkdirSync(UPLOAD_DIR, { recursive: true });

module.exports = function start(ip, port) {
   console.log('开始启动后台服务')
    const serverUrl = `http://${ip}`;

    
    
    app.get('/qrcode', (req, res) => {
      QRCode.toDataURL(serverUrl, (err, url) => {
        res.send(`<img src="${url}" style="width:200px;height:200px">`);
      });
    });

    // 新增分片上传接口
    app.post('/upload', express.json(), (req, res) => {
        const { file, chunk, index, total } = req.body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const saveDir = path.join(UPLOAD_DIR, timestamp);
        
        // 创建时间戳目录
        !fs.existsSync(saveDir) && fs.mkdirSync(saveDir, { recursive: true });
        
        // 保存分片
        const chunkPath = path.join(saveDir, `${file}-${index}`);
        fs.writeFileSync(chunkPath, Buffer.from(chunk, 'base64'));
        
        res.json({ status: index < total -1 ? 'continue' : 'complete' });
    });

    // 新增合并接口
    app.post('/merge', express.json(), (req, res) => {
        const { file, total } = req.body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const saveDir = path.join(UPLOAD_DIR, timestamp);
        const outputPath = path.join(saveDir, file);

        // 合并分片
        const writer = fs.createWriteStream(outputPath);
        for (let i = 0; i < total; i++) {
            const chunkPath = path.join(saveDir, `${file}-${i}`);
            writer.write(fs.readFileSync(chunkPath));
            fs.unlinkSync(chunkPath); // 删除分片
        }
        writer.end();
        
        res.json({ status: 'success', path: outputPath });
    });
  
    app.listen(port, () => {
      process.send && process.send('ready');
    });
}
