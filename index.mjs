import { Connection, PublicKey } from '@solana/web3.js';
import moment from 'moment';
import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connection = new Connection(
    process.env.SOLANA_RPC_URL,
    'confirmed',
    { fetch, maxSupportedTransactionVersion: 0 }
);

const walletAddress = process.env.WALLET_ADDRESS;
const publicKey = new PublicKey(walletAddress);

async function fetchTransactionHistory() {
    const signatures = await connection.getConfirmedSignaturesForAddress2(publicKey, { limit: 100 });//获取最近100笔交易
    const balanceHistory = [];

    for (let sig of signatures) {
        try {
            const tx = await connection.getParsedTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
            });

            if (tx && tx.meta) {
                // 找到我们钱包地址在账户列表中的索引
                const accountIndex = tx.transaction.message.accountKeys.findIndex(
                    account => account.pubkey.toString() === publicKey.toString()
                );

                if (accountIndex !== -1) {
                    const preBalance = tx.meta.preBalances[accountIndex] / Math.pow(10, 9);
                    const postBalance = tx.meta.postBalances[accountIndex] / Math.pow(10, 9);
                    const balanceChange = postBalance - preBalance;
                    const timestamp = tx.blockTime ? moment.unix(tx.blockTime).format('YYYY-MM-DD HH:mm:ss') : 'Unknown';

                    // 只记录实际发生余额变化的交易
                    if (Math.abs(balanceChange) > 0.000001) {
                        balanceHistory.push({
                            time: timestamp,
                            preBalance: preBalance,
                            postBalance: postBalance,
                            balanceChange: balanceChange,
                            signature: sig.signature,
                            type: tx.meta.logMessages?.join('\n') || ''
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error fetching transaction ${sig.signature}:`, error);
            continue;
        }
    }

    // 按时间排序
    balanceHistory.sort((a, b) => moment(a.time).valueOf() - moment(b.time).valueOf());
    
    // 保存详细的交易记录
    fs.writeFileSync('detailed_transactions.json', JSON.stringify(balanceHistory, null, 2));
    console.log('详细交易记录已保存到 detailed_transactions.json');

    return balanceHistory;
}

async function generateBalanceData() {
    try {
        const balanceHistory = await fetchTransactionHistory();
        const balanceData = [];
        
        // 处理历史交易记录
        for (const entry of balanceHistory) {
            balanceData.push({
                time: entry.time,
                balance: Number(entry.preBalance.toFixed(8)),
                change: Number(entry.balanceChange.toFixed(8))
            });
        }

        // 将数据保存到 JSON 文件
        fs.writeFileSync('balance_data.json', JSON.stringify(balanceData, null, 2));
        console.log('数据已保存到 balance_data.json');
        
        // 打印余额变化
        console.log('SOL Balance History:');
        console.log('-------------------');
        balanceData.forEach(entry => {
            console.log(`Time: ${entry.time}`);
            console.log(`Balance: ${entry.balance} SOL`);
            if (entry.change !== 0) {
                console.log(`Change: ${entry.change > 0 ? '+' : ''}${entry.change} SOL`);
            }
            console.log('-------------------');
        });

        return balanceData;
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

generateBalanceData();
