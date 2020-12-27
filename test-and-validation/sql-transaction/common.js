exports.dbConnect = function dbConnect(localhost){
    return require('knex')({
        client: 'mysql2',
        connection: {
            host: localhost,
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
}

exports.sleep = async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
} 