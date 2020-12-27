const { Resolver } = require('dns').promises
const resolver = new Resolver();

// for docker compliance
exports.parseLocalHost = async function parseLocalHost() {
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

exports.randomChooseElementFromArray = function randomChooseElementFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}