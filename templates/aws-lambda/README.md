# AWS Lambda 一键部署模板

`terraform/` 里的 Terraform 代码会创建 Lambda 函数（容器镜像不参与，直接 zip 代码包）、函数 URL、
并把 `MONGODB_URI` 作为环境变量注入。函数代码来自 `src/`——一个只有一行 `require` 的转发壳，
实现取 npm 上的 `@twikoojs/aws-lambda@latest`。

## 用法

```sh
cd templates/aws-lambda/src
npm install                       # 先把依赖装进 node_modules（Terraform 会把整个 src/ 打包）
cd ../terraform
terraform init
terraform apply -var="mongodb_uri=mongodb+srv://..."
```

`terraform output lambda_function_url` 打印出来的地址就是环境 id（含 `https://` 前缀），填到前端配置里。

## 为什么要先把依赖装进 `src/`

Terraform 的 `source_path = "../src"` 是**整个目录打包**，云端不会帮 Node.js 函数装依赖
（Python 才有内置的 `pip install` 步骤）。所以 `node_modules` 必须先在本地装好，
再打出的 zip 才带得动依赖。

## 与 1.x 的差异

- 1.x 的 `src/index.js` 里有一层「Lambda 事件 → Vercel 请求」的兼容层（把 `twikoo-vercel` 包起来）；
  2.0 的 `@twikoojs/aws-lambda` 自带实现，因此这里的 `src/index.js` 只剩一行转发。
- 运行时可改：`main.tf` 里写的是 `nodejs24.x`，2.0 产物语法目标是 ES2022，
  **最低 Node 20**（`nodejs20.x` 起可用）。
