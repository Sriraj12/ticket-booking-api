// const app = require("./app");
const cluster = require("cluster");
const os = require("os");

const totalCPUs = os.cpus().length;

if (cluster.isPrimary) {

    console.log(`Primary process: ${process.pid}`);

    // Create workers
    for (let i = 0; i < totalCPUs; i++) {
        cluster.fork();
    }

    // Restart worker if crashed
    cluster.on("exit", (worker) => {

        console.log(
            `Worker ${worker.process.pid} died`
        );

        console.log("Starting new worker...");

        cluster.fork();
    });

} else {

    // Run express app
    require("./app");

    console.log(
        `Worker started: ${process.pid}`
    );
}

