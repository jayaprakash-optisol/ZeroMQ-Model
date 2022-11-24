require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const productRouter = require('./routes/product');
const Logging = require('./utils/Logging');

const app = express();

let PORT, MONGO_URL;

const NODE_ENV = process.env.NODE_ENV || 'development';

NODE_ENV === 'production'
  ? ((PORT = process.env.PROD_PORT), (MONGO_URL = process.env.PROD_MONGO_URL))
  : ((PORT = process.env.DEV_PORT), (MONGO_URL = process.env.DEV_MONGO_URL));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/products', productRouter);

mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => Logging.info('ZeroMQ-Product-service Connected to MongoDB'))
  .catch((e) =>
    Logging.error(`Failed Connecting Product-service to MongoDB--> ${e}`)
  );

app.listen(PORT, () => {
  Logging.info(`Product-Service listening on port --> : ${PORT}`);
});
