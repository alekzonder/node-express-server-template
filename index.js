// node.js я юзаю lts 6.11.3, в октябре lts'ом станет node.js 8
// @see https://nodejs.org/en/

// поиск пакетов есть github и npm
// но есть еще один поисковик по npm-пакетам
// он выдает score для каждого пакета, иногда удобно оценивать какой пакет брать
// @see https://npms.io

// кодстайл не вкручиваю тут, но вообще мегапоплюярный код стайл airbnb c eslint-правилами
// там модный ES6 const, let и прочие модные вещи
// @see https://github.com/airbnb/javascript


// logger конечно может быть любой
// но bunyan логирует построчно json
// и потом удобно грепать и доставать информацию по логам
// все трейсы ошибок и прочее будет в одной строке
// можно добавлять данные и плюс есть удобные обработчики req, res, err
// смотри ниже про обработку ошибок
// и можно анализировать логи просто grep и jq
// @see https://github.com/trentm/node-bunyan
var bunyan = require('bunyan');
var logger = bunyan.createLogger({
    name: 'my-rest',
    serializers: {
        // дефолтный bunyan-обработчик для запроса, получает необходимую инфу для запроса
        req: bunyan.stdSerializers.req,

        // обработчик ошибок
        err: function (err) {
           if (!err || !err.stack) {
               return err;
           }

           // эта магия прогодится если для terror
           // если нужно будет дополню
           // if (typeof err.getFullStack === 'function') {
           //     err.stack = err.getFullStack();
           // }

            var obj = {
                message: err.message,
                name: err.name,
                stack: err.stack,
                code: err.code,
                signal: err.signal
            };

            return obj;
       }
    }
});
logger.level('trace');

// ну нужен и конфиг
var config = {
    host: process.env.HOST || null,
    port: process.env.PORT || 8000
};

// сразу добавляем два глобальных error-хэндлера чтобы ловить неотловленные ошибки
process.on('uncaughtException', (error) => {
      logger.fatal(error);
      // вообще при таких ошибка приложение должно падать
      // чтобы не было утечек памяти
      process.exit(255);
  });

  process.on('unhandledRejection', (reason, p) => {
      logger.fatal(reason, p);
      process.exit(255);
  });

// сам экспресс
// @see http://expressjs.com/
var express = require('express');

// остюда возьмем json-парсер для тела запроса
// @see https://github.com/expressjs/body-parser
var bodyParser = require('body-parser');

// чтобы работали кроссдоменные запросы из браузера если нужно
// see https://github.com/expressjs/cors
var cors = require('cors');

// создаем express app
var app = express();

// убираем заголовок что это express
app.disable('x-powered-by');
// убираем etag если нужно
app.disable('etag');
// если будет стоять за nginx-прокси или чем то подобным
// будет понимать X-Forwarded-For-* заголовки и подставлять реальные ip и прочее
app.set('trust proxy');

// TODO тут не пишу про access-логи, но если они нужны могу дополнить
// @see https://github.com/expressjs/morgan

// добавляем CORS заголовки
// тут все разрешено
app.use(cors({
    origin: '*', // <=== разрешено делать запросы с любых доменов
    preflightContinue: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
}));

// вообще круто иметь уникальный x-request-id на каждый запрос
// поэтому он будет либо от proxy, либо нужно будет сгенерировать
app.use(function xRequestId(req, res, next) {
    var reqId = req.headers['x-request-id'];

    if (!reqId) {
        // генерируем request-id по-колхозному
        // но можно вкрутить uuid
        // @see https://github.com/kelektiv/node-uuid
        reqId = new Date().getTime() + '.' + Math.random();
    }

    // добавляем наш уникальный request-id в объект запроса
    req.id = reqId;

    next();
});

// еще нужно иметь логгер на каждый запрос из него можно будет получить лог по каждому запросу
app.use(function requestLogger(req, res, next) {
    // создаем логгер для запроса
    req.logger = logger.child({req_id: req.id})

    next();
});


// добавляет body-parser для json
app.use(
    bodyParser.json({
        // можно не делать,
        // но тогда body-parser будет парсить json только если заголовок content-type: application/json
        type: '*/*'
    })
);


app.use(function (error, req, res, next) {
    // обрабатываем ошибку
    // если это SyntaxError
    // то json в запросе плохой
    // может быть есть более красивое решение

    if (error instanceof SyntaxError) {
        return res.status(400).json({
            error: {
                message: 'invalid json',
                code: 'INVALID_JSON'
            }
        });
    } else {
        next(error);
    }

})

// теперь можно начинать пилить хэндлеры для запросов

app.get('/api/todos', function (req, res) {
    req.logger.debug('тут я сходил в БД и получил список');
    // req.headers - заголовки
    // req.query - GET-параметры
    res.json({result: [1,2,3]});
});

app.post('/api/todos', function (req, res) {
    var body = req.body; // тут тело запроса уже распрсил body-parser

    req.logger.debug({body}, 'добавление нового itema');

    // типа какая-то асинхронная операция
    Promise.resolve(body)
        .then((todo) => {

            req.logger.trace({todo}, 'новый item добавлен');

            // добавляется в БД и как-то обрабатывается

            // если нужно возвращать значения с предыдущих promise-шагов
            // ну либо ты будешь юзать async/await
            return Promise.all([
                todo,
                Promise.resolve('save_to_operation_log')
            ]);
        })
        .then(([todo, log]) => {

            req.logger.trace({log}, 'записали в лог операций');

            res.json({
                todo,
                log
            })
        })
        .catch((error) => {
            // тут ошибку можно обработать по коду
            // или пробросить дальше чтобы ее обработало в  error middleware
            // можно конечно залогировать прям тут
            // но лучше чтобы эта логика было общая
            //
            // для ошибок мне больше всех нравиться terror
            // это чуваки с yandex'a
            // @see https://github.com/nodules/terror

            next(error);

            // ниже будет обработчик и пример про ошибки
        });
});


app.get('/server_error', function (req, res, next) {
    // возникает ошибка
    next(new Error('test server error'));
});

// error handler сюда будут попадать все ошибки если вызван next(error)
// ну или возникла ошибка где то в мидлварях
// @see http://expressjs.com/en/guide/error-handling.html
app.use(function (error, req, res, next) {

    // какие-то общие ошибки можно обработать тут или создать перед этим error handler еще один
    // и там обрабатываьт известные ошибки и делать next если ошибка неизвестная

    // логируем через bunyan и получаем красивый лог првязаннй к запросу
    req.logger.error({req: req, err: error});

    res.status(500).json({
        error: {
            message: 'Server Error',
            code: 'SERVER_ERROR'
        }
    });
});

var server = app.listen(config.port, config.host, function () {
    logger.info(`listen on ${config.host}:${config.port}`);
});

// для того чтобы это все это рестартовало быстро на проде
// нужно реагировать на SIGINT, SIGTERM

// коллекционаируем коннекты чтобы потом их прибить
var connections = {};
server.on('connection', function (connection) {

    var key = connection.remoteAddress + ':' + connection.remotePort;

    connections[key] = connection;

    connection.on('close', function () {
        delete connections[key];
    });

});

function shutdown(signal, value) {
    var promises = [];

    // тут можно прибивать и коннкты к БД и тд и тп

    promises.push(new Promise((resolve, reject) => {

        logger.info('stopping http server');

        server.close(function () {
            logger.info('http server stopped by ' + signal);
            resolve();
        });

        server.getConnections(function (error, count) {

            if (error) {
                return reject(error);
            }

            for (var key in connections) {
                connections[key].destroy();
            }

            logger.info(`http server: destroy ${count} connections`);

        });

    }));

    Promise.all(promises)
        .then(() => {
            logger.info('shutdown complete');
            process.exit(128 + value);
        })
        .catch((error) => {
            logger.error(error);
            process.exit(128 + value);
        });
}


// ставим обработчик shutdown на сигналы системы
var signals = {
    'SIGINT': 2,
    'SIGTERM': 15
};

Object.keys(signals).forEach(function (signal) {

    process.on(signal, function () {
        logger.info(`CATCH SIGNAL ${signal}`);
        shutdown(signal, signals[signal]);
    });

});
