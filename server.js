const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const app = express();

// 创建上传目录
const UPLOAD_DIR = 'C://anytime';
!fs.existsSync(UPLOAD_DIR) && fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 在express初始化后添加body大小限制
app.use(express.json({ limit: '5mb' })); // 调整JSON解析大小限制

module.exports = function start(ip, port) {
    console.log('开始启动后台服务')
    const serverUrl = `${ip}/mobile.html`;  // 修改此处添加移动端路径

    // 添加静态文件服务
    app.use(express.static(__dirname));
    
    app.get('/qrcode', (req, res) => {
      QRCode.toDataURL(serverUrl, (err, url) => {
        res.send(`<img src="${url}" style="width:200px;height:200px">`);
      });
    });

    // 修改分片上传接口
    app.post('/upload', (req, res) => {
        const { file, chunk, index, total, timestamp } = req.body; // 新增timestamp参数
        console.log('文件开始上传', chunk, index, total, timestamp)
        const saveDir = path.join(UPLOAD_DIR, timestamp);
        
        // 创建目录时添加存在性检查
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        
        // 添加文件名安全处理
        const safeFileName = file.replace(/[^a-z0-9.]/gi, '_');
        const chunkPath = path.join(saveDir, `${safeFileName}-${index}`);
        
        // 改用异步写入
        fs.writeFile(chunkPath, Buffer.from(chunk, 'base64'), (err) => {
            if (err) return res.status(500).json({ error: '分片保存失败' });
            res.json({ status: index < total -1 ? 'continue' : 'complete' });
        });
    });

    // 修改合并接口
    app.post('/merge', async (req, res) => {
        const { file, total, timestamp } = req.body; // 新增timestamp参数
        const saveDir = path.join(UPLOAD_DIR, timestamp);
        const safeFileName = file.replace(/[^a-z0-9.]/gi, '_');
        const outputPath = path.join(saveDir, safeFileName);

        try {
            // 改用异步流式写入
            const writer = fs.createWriteStream(outputPath);
            for (let i = 0; i < total; i++) {
                const chunkPath = path.join(saveDir, `${safeFileName}-${i}`);
                const data = await fs.promises.readFile(chunkPath);
                writer.write(data);
                await fs.promises.unlink(chunkPath);
            }
            writer.end();
            res.json({ status: 'success', path: outputPath });
        } catch (err) {
            res.status(500).json({ error: '文件合并失败' });
        }
    });
  
    app.listen(port, () => {
      process.send && process.send('ready');
    });
}
