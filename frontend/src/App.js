import React, { useState } from 'react';
import { Layout, Input, Button, Table, Card, Row, Col, message } from 'antd';
import { Connection, PublicKey } from '@solana/web3.js';
import moment from 'moment';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const { Header, Content } = Layout;

// 定义常量
const TIMEOUT_MS = 10000; // 10秒超时
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY = 2000; // 重试延迟2秒

function App() {
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [balanceData, setBalanceData] = useState([]);
  const [transactionLimit, setTransactionLimit] = useState(100);

  const columns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
    },
    {
      title: '交易前余额',
      dataIndex: 'preBalance',
      key: 'preBalance',
      render: (val) => val.toFixed(4),
    },
    {
      title: '余额变化',
      dataIndex: 'balanceChange',
      key: 'balanceChange',
      render: (val) => (
        <span style={{ color: val > 0 ? 'green' : 'red' }}>
          {val > 0 ? '+' : ''}{val.toFixed(4)}
        </span>
      ),
    },
    {
      title: '交易后余额',
      dataIndex: 'postBalance',
      key: 'postBalance',
      render: (val) => val.toFixed(4),
    },
  ];

  // 添加超时控制的Promise包装器
  const withTimeout = (promise, timeout) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('请求超时')), timeout)
      )
    ]);
  };

  // 添加重试逻辑的函数
  const withRetry = async (fn, retries = MAX_RETRIES, delay = RETRY_DELAY) => {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay);
      }
      throw error;
    }
  };

  // 获取单个交易数据
  const fetchTransaction = async (connection, signature) => {
    return withTimeout(
      connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0
      }),
      TIMEOUT_MS
    );
  };

  const fetchBalanceHistory = async () => {
    try {
      if (!walletAddress?.trim() || !rpcUrl?.trim() || !transactionLimit) {
        message.error('请填写所有必填字段');
        return;
      }

      if (transactionLimit < 1 || transactionLimit > 1000) {
        message.error('查询交易笔数需要在 1-1000 之间');
        return;
      }

      setLoading(true);

      // 验证钱包地址和RPC URL
      let publicKey;
      try {
        publicKey = new PublicKey(walletAddress);
        new URL(rpcUrl);
      } catch (error) {
        setLoading(false);
        message.error('无效的钱包地址或RPC URL格式');
        return;
      }

      // 创建连接
      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: TIMEOUT_MS
      });

      // 测试连接
      await withRetry(async () => {
        try {
          await withTimeout(connection.getLatestBlockhash(), TIMEOUT_MS);
        } catch (error) {
          message.warning('RPC连接不稳定，正在重试...');
          throw error;
        }
      });

      // 获取交易签名
      const signatures = await withTimeout(
        connection.getConfirmedSignaturesForAddress2(publicKey, { limit: parseInt(transactionLimit) }),
        TIMEOUT_MS
      );

      const history = [];
      let processedCount = 0;
      const totalCount = signatures.length;

      // 处理每个交易
      for (let sig of signatures) {
        try {
          const tx = await withRetry(async () => {
            return await fetchTransaction(connection, sig.signature);
          });

          if (tx?.meta) {
            const accountIndex = tx.transaction.message.accountKeys.findIndex(
              account => account.pubkey.toString() === publicKey.toString()
            );

            if (accountIndex !== -1) {
              const preBalance = tx.meta.preBalances[accountIndex] / Math.pow(10, 9);
              const postBalance = tx.meta.postBalances[accountIndex] / Math.pow(10, 9);
              const balanceChange = postBalance - preBalance;
              const timestamp = tx.blockTime 
                ? moment.unix(tx.blockTime).format('YYYY-MM-DD HH:mm:ss') 
                : 'Unknown';

              if (Math.abs(balanceChange) > 0.000001) {
                history.push({
                  time: timestamp,
                  preBalance,
                  postBalance,
                  balanceChange,
                  signature: sig.signature
                });
              }
            }
          }

          processedCount++;
          if (processedCount % 10 === 0) {
            message.info(`已处理 ${processedCount}/${totalCount} 笔交易`);
          }
        } catch (error) {
          console.error(`处理交易 ${sig.signature} 时出错:`, error);
          message.warning(`跳过处理失败的交易: ${sig.signature.slice(0, 8)}...`);
          continue;
        }
      }

      if (history.length > 0) {
        setBalanceData(history);
        message.success(`成功获取 ${history.length} 笔交易数据！`);
      } else {
        message.warning('未找到余额变化记录');
      }
    } catch (error) {
      console.error('Error:', error);
      message.error(error.message || '发生未知错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'fixed',
        width: '100%',
        zIndex: 1,
      }}>
        <h1 style={{ margin: 0, lineHeight: '64px' }}>Solana 钱包余额追踪</h1>
      </Header>
      
      <Content style={{ padding: '24px', marginTop: 64 }}>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24} sm={24} md={8} lg={7} xl={7}>
              <Input
                placeholder="输入钱包地址"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                style={{ marginBottom: 16 }}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={7} xl={7}>
              <Input
                placeholder="输入 RPC URL"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                style={{ marginBottom: 16 }}
              />
            </Col>
            <Col xs={24} sm={24} md={4} lg={5} xl={5}>
              <Input
                type="number"
                placeholder="查询交易笔数"
                value={transactionLimit}
                onChange={(e) => setTransactionLimit(e.target.value)}
                min={1}
                max={1000}
                style={{ marginBottom: 16 }}
              />
            </Col>
            <Col xs={24} sm={24} md={4} lg={5} xl={5}>
              <Button 
                type="primary" 
                onClick={fetchBalanceHistory} 
                loading={loading}
                style={{ width: '100%' }}
              >
                查询
              </Button>
            </Col>
          </Row>
        </Card>

        {balanceData.length > 0 && (
          <Row gutter={24}>
            <Col xs={24} md={24} lg={16} xl={16}>
              <Card title="余额变化趋势" style={{ marginBottom: 24 }}>
                <div style={{ height: 500, margin: '0 -24px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={[...balanceData].reverse()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tickCount={8}
                        domain={['auto', 'auto']}
                        tickFormatter={value => value.toFixed(4)}
                        width={80}
                      />
                      <Tooltip 
                        formatter={value => value.toFixed(4)}
                        labelStyle={{ color: '#666' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="postBalance" 
                        stroke="#1890ff"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={24} lg={8} xl={8}>
              <Card title="交易详情" style={{ marginBottom: 24 }}>
                <Table
                  columns={columns}
                  dataSource={[...balanceData].sort((a, b) => moment(b.time).valueOf() - moment(a.time).valueOf())}
                  rowKey="signature"
                  pagination={{ pageSize: 10 }}
                  scroll={{ y: 400 }}
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        )}
      </Content>
    </Layout>
  );
}

export default App;