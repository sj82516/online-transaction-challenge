const faker = require('faker');

async function main() {
    let knex = null;
    try {
        knex = require('knex')({
            client: 'mysql2',
            connection: {
                host: 'mysql',
                user: 'api-server',
                password: 'hello-world',
                database: 'online-transaction'
            },
            acquireConnectionTimeout: 60000,
            pool: {
                min: 5,
                max: 10
            }
        });

        await createTables(knex);
        await insertFakeData(knex);

        console.log('finished!')
    } catch (err) {
        console.log(JSON.stringify(err));
        if(err && err.code === 'ECONNREFUSED'){
            // there are no built in db reconnect mechanism
            await sleep(10000);
            main();
        }
    } finally {
        knex.destroy();
    }
}

main();

async function createTables(knex) {
    await knex.schema.createTableIfNotExists('users', function (table) {
        table.increments('id');
        table.string('name', 1000);
    });
    await knex.schema.createTableIfNotExists('products', function (table) {
        table.increments('id');
        table.string('name', 100);
        table.integer('total').notNullable();
        table.integer('price').notNullable();
        table.integer('sold').defaultTo(0);
    });
    await knex.schema.createTableIfNotExists('bank_accounts', function (table) {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable();
        table.integer('balance');

        table.foreign('user_id').references('id').inTable('users')
    });
    await knex.schema.createTableIfNotExists('orders', function (table) {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable();
        table.integer('product_id').unsigned().notNullable();
        table.integer('cost').notNullable();
        table.integer('amount').notNullable();
        table.boolean('is_cancel').defaultTo(false);
        
        table.foreign('user_id').references('id').inTable('users');
        table.foreign('product_id').references('id').inTable('products');
    });
}

async function insertFakeData(knex) {
    let fakeUserList = [];
    for (let i = 0; i < 1000; i++) {
        fakeUserList.push({
            name: faker.name.lastName()
        })
    }
    await knex.batchInsert('users', fakeUserList, 1000);

    let fakeProductList = [];
    for (let i = 0; i < 1000; i++) {
        fakeProductList.push({
            name: faker.commerce.productName(),
            total: 100 + Math.floor(Math.random() * 100),
            price: faker.commerce.price()
        });
    }
    await knex.batchInsert('products', fakeProductList, 100);

    const userIdList = await knex('users').select('id');
    const fakeBankAccount = userIdList.map(user => {
        return {
            user_id: user.id,
            balance: 10000
        }
    })
    await knex.batchInsert('bank_accounts', fakeBankAccount, 100);
}


function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }   