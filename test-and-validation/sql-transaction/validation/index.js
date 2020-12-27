const {parseLocalHost} = require('../../common');
const {dbConnect, sleep} = require('../common');

async function main() {
    let knex = null;
    let localhost = await parseLocalHost();
    try {
        knex = dbConnect(localhost);
    
        console.log("start sql transaction validation, it would take around 1 minutes.")
        await validate(knex);
    } catch (err) {
        console.error(err)
        if (err && err.code === 'ECONNREFUSED') {
            // there are no built in db reconnect mechanism
            await sleep(10000);
            main();
        }
    } finally {
        knex.destroy();
    }
}

main();

async function validate(knex) {
    const {
        productList,
        bankAccountList,
        orderList
    } = await getAllData(knex);

    await checkNoDebtBankAccout(bankAccountList);
    await checkProductAndOrderBalance({
        productList,
        orderList
    })
    await checkUserAndOrderBalance({
        bankAccountList,
        orderList
    })

    const totalErned = orderList.reduce((sum, order) => sum += order.cost, 0);
    console.log(`Congradulations! Your service complete ${orderList.length} orders and erned $${totalErned} successfully.`)
}

async function getAllData(knex) {
    const productList = await knex('products').select('*');
    const bankAccountList = await knex('bank_accounts').select('*');
    const orderList = await knex('orders').select('*');

    return {
        productList,
        bankAccountList,
        orderList
    }
}

function checkNoDebtBankAccout(bankAccountList) {
    const anyDebt = bankAccountList.some(account => account.balance < 0);
    if (anyDebt) {
        throw Error("There are debt in bank account!");
    }
}

function checkProductAndOrderBalance({
    productList,
    orderList
}) {
    productList.filter(product => {
        const relatedOrderList = orderList.filter(order => order.product_id === product.id);
        const totalSold = relatedOrderList.reduce((sum, order) => sum += order.amount, 0);

        if (totalSold !== product.sold) {
            throw Error("product sold and total orders are not matched.")
        }
    })
}

function checkUserAndOrderBalance({
    bankAccountList,
    orderList
}){
    let wrongUserNum = 0;
    const diffSum = bankAccountList.reduce((diff, account) => {
        const relatedOrderList = orderList.filter(order => order.user_id === account.user_id);
        const totalSold = relatedOrderList.reduce((sum, order) => sum += order.cost, 0);

        if (account.balance !== 10000 - totalSold) {
            wrongUserNum ++;
            diff += diff + (10000 - totalSold - account.balance)
        }
        return diff;
    }, 0)

    if(wrongUserNum > 0){
        throw Error(`There are ${wrongUserNum} users with total inbalance money $${diffSum}`);
    }
}