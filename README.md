# SOL Balance Tracker

一个用于追踪 Solana 钱包 SOL 余额变化历史的工具。

## 功能特点

- 支持查询任意 Solana 钱包地址
- 可自定义查询交易笔数(1-1000笔)
- 计算每笔交易前后的 SOL 余额变化
- 可视化展示余额变化趋势图表
- 展示详细的交易记录列表

### 截图演示

以下是应用程序的可视化图表示例：

![SOL Balance Chart](./attachment/presentation.png)

## 安装

1. **克隆仓库**

```bash
git clone https://github.com/ranxi2001/sol-balance-tracker.git
cd sol-balance-tracker/frontend
```

2. **安装依赖**

```bash
pnpm install
```

## 使用方法

1. 启动开发服务器

```bash
pnpm start
```

2. 在浏览器中访问 http://localhost:3000
3. 输入以下信息开始查询:

   - Solana 钱包地址

   - RPC 节点 URL

   - 查询交易笔数(1-1000)


## 技术栈

- React 18
- Ant Design 5.0
- Recharts 2.5
- @solana/web3.js
- moment.js

## 主要改动：

- 移除了后端相关内容
- 更新了安装和启动说明
- 添加了新功能说明(自定义查询笔数)
- 更新了技术栈说明
- 简化了使用方法

## 注意事项

- 需要有效的 Solana RPC URL
- 建议使用 Node.js 16+ 版本
- 确保钱包地址格式正确

- License： `MIT`

