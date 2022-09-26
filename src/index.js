var dotenv = require('dotenv/config');
var express = require('express');
const app = express();

app.get('/', (req, res) => {
  console.log(`/ GET Call`),
  res.send('Hello World!');
});

app.listen(process.env.PORT, () =>
  console.log(`Node Express Server listening on port ${process.env.PORT}!`),
);
