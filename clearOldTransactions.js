// const { PrismaClient } = require("@prisma/client");
// const prisma = new PrismaClient();
// const schedule = require("node-schedule");

// async function main() {
//   const currTime = Math.floor(new Date().getTime() / 1000);
//   const oldTime = currTime - 60 * 60 * 24 * 30;

//   try {
//     await prisma.transactions.deleteMany({
//       where: {
//         timeStamp: {
//           lt: oldTime,
//         },
//       },
//     });
//   } catch (e) {
//     console.error(e);
//   }
// }

// const rule = new schedule.RecurrenceRule();
// rule.hour = 0;
// rule.minute = 0;
// rule.tz = "IST";

// const job = schedule.scheduleJob(rule, main);
