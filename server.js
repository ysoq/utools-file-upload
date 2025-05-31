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
    // 新增上传任务存储对象
    const uploadTasks = new Map();
    
    // 在分片上传接口中添加任务记录
    app.post('/upload', (req, res) => {
        const { file, chunk, index, total, timestamp } = req.body;
        console.log('文件开始上传', chunk, index, total, timestamp)
        
        // 更新任务状态
        const taskKey = `${timestamp}_${file}`;
        if (!uploadTasks.has(taskKey)) {
            uploadTasks.set(taskKey, {
                fileName: file,
                totalChunks: total,
                uploadedChunks: 0,
                startTime: Date.now(),
                status: 'uploading'
            });
        }
        const task = uploadTasks.get(taskKey);
        task.uploadedChunks = Math.max(task.uploadedChunks, index + 1);
        
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
        const { file, total, timestamp } = req.body;
        const saveDir = path.join(UPLOAD_DIR, timestamp);
        const outputPath = path.join(saveDir, file);
        
        // 新增安全文件名定义（与上传接口保持一致）
        const safeFileName = file.replace(/[^a-z0-9.]/gi, '_');
    
        try {
            const writer = fs.createWriteStream(outputPath);
            
            // 改用管道方式写入并添加错误处理
            for (let i = 0; i < total; i++) {
                const chunkPath = path.join(saveDir, `${safeFileName}-${i}`);
                const reader = fs.createReadStream(chunkPath);
                await new Promise((resolve, reject) => {
                    reader.pipe(writer, { end: false });
                    reader.on('end', () => {
                        fs.unlink(chunkPath, () => resolve());
                    });
                    reader.on('error', reject);
                });
            }
            
            writer.end();
    
            // 更新任务状态为已完成
            // 更新任务状态时需要保持文件名一致性
            const taskKey = `${timestamp}_${file}`;
            const task = uploadTasks.get(taskKey);
            if (task) {
                task.status = 'completed';
                task.filePath = outputPath;
                task.fileName = file; // 确保任务记录中的文件名是原始名称
            }
    
            res.json({ status: 'success', path: outputPath });
        } catch (err) {
            res.status(500).json({ error: '文件合并失败' });
        }
    });

    // 新增任务查询接口
    app.get('/tasks', (req, res) => {
        res.json(Array.from(uploadTasks.values()));
    });
  
    app.listen(port, () => {
      process.send && process.send('ready');
    });
}
