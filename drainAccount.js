const { ethers } = require("ethers");
const { PrismaClient } = require("@prisma/client");
const EthDater = require("ethereum-block-by-date");
const express = require("express");
const app = express();
const prisma = new PrismaClient();

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL;
const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);

const dater = new EthDater(provider);
var id = -1;
const retryDelay = 10000;

let abi = ["function balanceOf(address account)"];
let iface = new ethers.utils.Interface(abi);

const top10Token = [
  {
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    name: "USDT",
  },
  {
    address: "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
    name: "BNB",
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    name: "USDC",
  },
  {
    address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    name: "stETH",
  },
  {
    address: "0x50327c6c5a14DCaDE707ABad2E27eB517df87AB5",
    name: "TRON",
  },
  {
    address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
    name: "MATIC",
  },
  {
    address: "0x3883f5e181fccaF8410FA61e12b59BAd963fb645",
    name: "THETA",
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    name: "WBTC",
  },
  {
    address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    name: "SHIB",
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    name: "DAI",
  },
];

function changetokenValue(name, startingBalance, endingBalance, obj) {
  var netChange;
  if (obj[name] == undefined) {
    if (startingBalance != 0) {
      netChange = ((endingBalance - startingBalance) / startingBalance) * 100;
    } else {
      netChange = 0;
    }

    obj[name] = {
      initialValue: startingBalance,
      diffvalue: endingBalance - startingBalance,
      netChange: netChange,
    };
  } else {
    const initialValue = obj[name]["initialValue"] + startingBalance;
    const diffvalue = obj[name]["diffvalue"] + endingBalance - startingBalance;

    if (initialValue != 0) {
      netChange = (diffvalue / initialValue) * 100;
    } else {
      netChange = 0;
    }

    obj[name] = {
      initialValue: initialValue,
      diffvalue: diffvalue,
      netChange: netChange,
    };
  }
  return obj;
}

async function drainedAccounts() {
  const batchSize = 100;
  const transactions = await prisma.Transactions.findMany({
    where: {
      id: { gt: id },
    },
    orderBy: {
      id: "asc",
    },
    take: batchSize,
  });

  const tokenUpdate = [];

  for (const transaction of transactions) {
    id = transaction.id;
    const { from, to, timeStamp, blockNumber } = transaction;
    const startBlock = parseInt(blockNumber) - 1;

    let contract = await prisma.ContractAddresses.findFirst({
      where: {
        address: {
          equals: to,
          mode: "insensitive",
        },
      },
    });

    if (contract == null) {
      contract = await prisma.ContractAddresses.create({
        data: {
          address: to,
        },
      });
    }

    let obj = JSON.parse(contract.tokenValue);
    const value = obj.ETH;

    let retries = 0;
    const maxRetries = 3;
    let endBlock;

    while (retries < maxRetries) {
      try {
        endBlock = (await dater.getDate((timeStamp + 10 * 60) * 1000)).block;

        const [startingBalance, endingBalance] = await Promise.all([
          provider.getBalance(from, startBlock),
          provider.getBalance(from, parseInt(endBlock)),
        ]);

        const startingBalanceInt = parseInt(startingBalance._hex);
        const endingBalanceInt = parseInt(endingBalance._hex);

        obj = changetokenValue(
          "ETH",
          startingBalanceInt,
          endingBalanceInt,
          obj
        );
        break;
      } catch (err) {
        console.log(err);
        retries++;
        await delay(retryDelay);
      }
    }

    const callData = iface.encodeFunctionData("balanceOf", [from]);

    const tokenPromises = top10Token.map(async (token) => {
      retries = 0;
      while (retries < maxRetries) {
        try {
          const [startingBalance, endingBalance] = await Promise.all([
            provider.call({
              to: token.address,
              data: callData,
              blockTag: startBlock,
            }),
            provider.call({
              to: token.address,
              data: callData,
              blockTag: parseInt(endBlock),
            }),
          ]);

          const startingBalanceInt = parseInt(
            ethers.BigNumber.from(startingBalance)
          );
          const endingBalanceInt = parseInt(
            ethers.BigNumber.from(endingBalance)
          );

          obj = changetokenValue(
            token.name,
            startingBalanceInt,
            endingBalanceInt,
            obj
          );
          break;
        } catch (err) {
          console.log(err);
          retries++;
          await delay(retryDelay);
        }
      }
    });

    await Promise.all(tokenPromises);

    const tokenValue = JSON.stringify(obj);
    console.log(id);
    // console.log(tokenValue + "\n");

    tokenUpdate.push({
      to,
      tokenValue,
    });
  }

  tokenUpdate.forEach(async (update) => {
    try {
      await prisma.ContractAddresses.updateMany({
        where: {
          address: {
            equals: update.to,
            mode: "insensitive",
          },
        },
        data: {
          tokenValue: update.tokenValue,
        },
      });
    } catch (error) {
      console.log(error);
    }
  });

  setTimeout(drainedAccounts, 1 * 60 * 1000);
}

drainedAccounts();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
