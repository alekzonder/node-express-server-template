module.exports = {
    apps: [
        {
            name: 'node-express-server',
            // @see http://pm2.keymetrics.io/docs/usage/cluster-mode/
            exec_mode: 'cluster',
            instances: 2,
            // тут должен быть какой-то постоянный путь на проде или в контейнере
            cwd: process.cwd(),
            script: 'index.js',
            env: {
                NODE_ENV: 'dev',
                // можно изменять порт ну и любые другие параметры через env-переменные
                PORT: 3000
            },
            // для dev'a pm2 будет рестартовать при изменениях
            watch: true,
            // мерждить логи от нескольких инстансов в один лог output и error
            merge_logs: true,

            // вообще pm2 создаст свот home по умолчанию в $home/.pm2
            // можно изменять это через PM2_HOME=/data/soft/node-express-server
            out_file: '/tmp/node-express-server.output.log',
            error_file: '/tmp/node-express-server.error.log',
            pid_file: '/tmp/node-express-server.pid'
        }
    ]
};
