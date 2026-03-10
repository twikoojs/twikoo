# Local Development

**Node.js** and **Yarn** are required.

## Backend

### Install dependencies

```
cd src/server/function/twikoo
yarn
yarn link
cd ../../self-hosted
yarn
yarn link twikoo-func
```

### Start

```
cd src/server/self-hosted
node server.js
```

## Frontend

### Install dependencies

```
yarn
```

### Start

```
yarn dev
```

Open <http://localhost:9820> in browser.

## Code check and fix

```
yarn lint --fix
```
