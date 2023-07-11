const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { top10Token_ETHEREUM, top10Token_POLYGON } = require("./constant");
const fs = require("fs");

async function main(top10Tokens) {
  const tokens = "USDT,BNB,USDC,BUSD,MATIC,WBTC,AVAX,SHIB,DAI,UNI";
  const response = await fetch(
    `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${tokens}&tsyms=USD`
  );

  const price = await response.json();
  const result = [];

  const contractAddresses = await prisma.contractAddresses.findMany({
    where: {
      network: "POLYGON_MAINNET",
    },
  });

  for (const contract of contractAddresses) {
    const tokenValue = JSON.parse(contract.tokenValue);

    if (Object.keys(tokenValue).length === 0) {
      continue;
    }

    var diffSum = 0;
    var initialSum = 0;

    diffSum = (tokenValue["ETH"]["diffvalue"] * price["MATIC"]["USD"]) / 1e18;
    initialSum =
      (tokenValue["ETH"]["initialValue"] * price["MATIC"]["USD"]) / 1e18;

    top10Tokens.forEach((top10Token) => {
      diffSum +=
        (tokenValue[top10Token.name]["diffvalue"] *
          price[top10Token.name]["USD"]) /
        10 ** top10Token.decimals;
      initialSum +=
        (tokenValue[top10Token.name]["initialValue"] *
          price[top10Token.name]["USD"]) /
        10 ** top10Token.decimals;
    });

    var netChange = (diffSum / initialSum) * 100;
    if (netChange < -5) {
      result.push({
        address: contract.address,
        total_initial_USD_value: initialSum,
        total_diff_USD_value: diffSum,
        netChange: netChange,
      });
    }
  }

  // console.log(result);
  // write result to a file
  fs.writeFileSync("netLost.json", JSON.stringify(result));
}

main(top10Token_POLYGON);
