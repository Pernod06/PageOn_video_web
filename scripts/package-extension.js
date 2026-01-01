import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionDir = path.join(__dirname, "..", "extension");
const outputPath = path.join(__dirname, "..", "public", "extension.zip");

// 确保 public 目录存在
const publicDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 创建输出流
const output = fs.createWriteStream(outputPath);
const archive = archiver("zip", {
  zlib: { level: 9 }, // 最高压缩级别
});

// 监听所有 archive 数据都写入完成
output.on("close", () => {
  console.log(`✅ Extension packaged successfully!`);
  console.log(`   Total bytes: ${archive.pointer()}`);
  console.log(`   Output: ${outputPath}`);
});

archive.on("error", (err) => {
  throw err;
});

// 将输出流连接到 archive
archive.pipe(output);

// 添加 extension 目录下的所有文件
archive.directory(extensionDir, false);

// 完成打包
archive.finalize();
