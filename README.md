# node-express-server-template


## install

```bash
npm i
# or
yarn

# установить pm2 глобально
npm i -g pm2
# or
yarn global add pm2


# установить bunyan глобально чтобы смотреть логи
npm i -g bunyan
# or
yarn global add bunyan
```

# usage

простой запуск

```bash
node index.js | bunyan
```

стартуем кластер из двух процессов

```bash
# @see http://pm2.keymetrics.io/docs/usage/cluster-mode/
pm2 start ecosystem.config.js

# смотреть логи
pm2 logs -f --raw | bunyan

pm2 ls
pm2 delete node-express-server


```


```bash

curl -sv -XPOST -d'{"id": 1}' http://localhost:3000/api/todos | jq '.'

curl -sv  -XGET http://localhost:3000/api/todos | jq '.'

```
