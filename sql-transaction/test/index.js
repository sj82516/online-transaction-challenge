const event = require('events')
const { Resolver } = require('dns').promises
const process = require('process')
const axios = require('axios')

const resolver = new Resolver();

async function main() {
    let knex = null;
    let localhost = await parseLocalHost();
    const apiHost = process.env.api_host || `http://${localhost}:3001/`

    const httpInstance = axios.default.create({
        baseURL: apiHost,
        timeout: 60000
    });

    try {
        knex = require('knex')({
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


        const [
            userIdList,
            productIdList
        ] = await getData(knex);

        console.log("start sql transaction test, it would take around 2 minutes.")
        const resultList = await execTest({
            userIdList,
            productIdList,
            httpInstance
        });

        logResult(resultList);
    } catch (err) {
        console.error(err);
    } finally {
        knex.destroy();
        process.exit();
    }
}

// for docker compliance
async function parseLocalHost() {
    let localhost = 'localhost'
    try {
        const dockerLocalHost = await resolver.resolve4('host.docker.internal');
        if (Array.isArray(dockerLocalHost) && dockerLocalHost[0]) {
            localhost = dockerLocalHost[0];
        }
    } catch (error) {
        // resolve failed, just ignore
    }

    return localhost
}

main();

async function getData(knex) {
    const userIdList = await knex('users').select('id');
    const productIdList = await knex('products').select('id');

    return [userIdList.map(user => user.id), productIdList.map(product => product.id)]
}

async function execTest({
    userIdList,
    productIdList,
    httpInstance
}) {
    return new Promise((res, rej) => {
        const activeJobThreshold = 20;
        const totalJobAmount = 2000;
        const jobControlEvent = new event();

        let completeJobCount = 0;
        let resultList = [];
        let isError = false;

        let sameProductRequestPossibility = 0.01;

        jobControlEvent.on('complete', (result) => {
            completeJobCount++;

            logProgress(completeJobCount, totalJobAmount);
            if (Array.isArray(result)) {
                resultList.push(...result);
            } else {
                resultList.push(result);
            }

            if (isError === false && completeJobCount < totalJobAmount) {
                if (Math.random() < sameProductRequestPossibility) {
                    multipleRequestForSameProduct({
                        userIdList,
                        productIdList,
                        httpInstance,
                        jobControlEvent,
                        activeJobThreshold
                    })
                } else {
                    execSingleRequest({
                        userIdList,
                        productIdList,
                        httpInstance,
                        jobControlEvent
                    });
                }
            } else {
                res(resultList)
            }
        });

        jobControlEvent.on('err', () => {
            isError = true;
            console.error('stop api test');
            rej();
        });

        for (let i = 0; i < activeJobThreshold; i++) {
            execSingleRequest({
                userIdList,
                productIdList,
                httpInstance,
                jobControlEvent
            });
        }
    })
}

function logResult(resultList) {
    const avgExecTime = resultList.reduce((sum, item) => sum += item.execTime, 0) / resultList.length;
    const successResult = resultList.filter(result => result.statusCode === 200);

    console.log(`total ${resultList.length} request, avg execution time : ${avgExecTime} with total ${successResult.length} success reqeust`)
}

async function execSingleRequest({
    userIdList,
    productIdList,
    httpInstance,
    jobControlEvent
}) {
    const randomUserId = randomChooseElementFromArray(userIdList);
    const randomProductId = randomChooseElementFromArray(productIdList);
    const amount = Math.floor(Math.random() * 5) + 1;

    let statusCode = null;
    let execTime = new Date();
    try {
        await buyProductRequest({
            httpInstance,
            productId: randomProductId,
            userId: randomUserId,
            amount
        })

        statusCode = 200;
    } catch (err) {
        if (err && err.response) {
            statusCode = err.response.status
        } else {
            console.error(err);
            jobControlEvent.emit('err')
        }
    } finally {
        execTime = new Date() - execTime;
        jobControlEvent.emit('complete', {
            execTime,
            statusCode
        })
    }
}

async function multipleRequestForSameProduct({
    userIdList,
    productIdList,
    httpInstance,
    jobControlEvent,
    activeJobThreshold
}) {
    const randomProductId = randomChooseElementFromArray(productIdList);

    const resultList = [];
    try {
        let execTime = new Date();
        await Promise.all(
            Array(activeJobThreshold).fill(0).map(async _ => {
                let statusCode = null;

                try {
                    const amount = Math.floor(Math.random() * 5) + 1;
                    const randomUserId = randomChooseElementFromArray(userIdList);
                    await buyProductRequest({
                        httpInstance,
                        productId: randomProductId,
                        userId: randomUserId,
                        amount
                    })
                    statusCode = 200;
                } catch (err) {
                    if (err && err.response) {
                        statusCode = err.response.status
                    } else {
                        console.error(err);
                        jobControlEvent.emit('err')
                    }
                } finally {
                    resultList.push({
                        statusCode,
                        execTime: new Date() - execTime
                    })
                }
            })
        )
    } catch (err) {
        jobControlEvent.emit('err')
    } finally {
        jobControlEvent.emit('complete', resultList)
    }
}

function logProgress(completeJobCount, totalJobAmount) {
    const logPoint = Array(10).fill(0).map((_, idx) => (totalJobAmount / 10) * (idx + 1));
    if (logPoint.includes(completeJobCount)) {
        console.log(`complete ${completeJobCount} requests`);
    }
}

async function buyProductRequest({
    httpInstance,
    productId,
    userId,
    amount
}) {
    return httpInstance.post(`/product/${productId}`, {
        userId,
        amount
    });
}

function randomChooseElementFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
} 