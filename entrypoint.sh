#!/bin/sh

# 进入项目目录 (Sealos 默认通常在 /app 或当前目录)
# 如果需要特定目录，请修改此处
cd "$(dirname "$0")"

# 如果 node_modules 不存在，则执行安装
if [ ! -d "node_modules" ]; then
  echo "node_modules not found, installing dependencies..."
  npm install
fi

# 执行构建
echo "Building the application..."
npm run build

# 启动应用
echo "Starting the application..."
npm run start
