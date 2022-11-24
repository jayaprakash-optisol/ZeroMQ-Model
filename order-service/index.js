require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const zmq = require('zeromq');
const Order = require('./models/Order');
const Logging = require('./utils/Logging');

const app = express();

let socket, PORT, MONGO_URL, ZMQ_SERVER_URL;

const NODE_ENV = process.env.NODE_ENV || 'development';

NODE_ENV === 'production'
  ? ((PORT = process.env.PROD_PORT),
    (MONGO_URL = process.env.PROD_MONGO_URL),
    (ZMQ_SERVER_URL = process.env.PROD_ZMQ_SERVER_URL))
  : ((PORT = process.env.DEV_PORT),
    (MONGO_URL = process.env.DEV_MONGO_URL),
    (ZMQ_SERVER_URL = process.env.DEV_ZMQ_SERVER_URL));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => Logging.info('ZeroMQ-Order-service Connected to MongoDB'))
  .catch((e) =>
    Logging.info(`Failed Connecting ZeroMQ-Order-service to MongoDB--> ${e}`)
  );

const connectToZeroMQ = async () => {
  socket = zmq.socket('rep');
  // socket = zmq.socket('sub');
  await socket.bind(ZMQ_SERVER_URL);
};

// Create an order
const createOrder = async (products) => {
  let total = 0;
  products.forEach((product) => {
    total += product.price;
  });

  try {
    const order = new Order({
      products,
      total,
    });
    await order.save();
    return order;
  } catch (error) {
    Logging.error('Unable to place order');
    throw new Error(error);
  }
};

connectToZeroMQ()
  .then(() => {
    Logging.info('ZeroMQ Connected Successfully');

    socket.on('message', async (message) => {
      Logging.info('---Received product data---');

      const products = JSON.parse(message);

      try {
        const newOrder = await createOrder(products);
        newOrder && (await socket.send(Buffer.from(JSON.stringify(newOrder))));
      } catch (e) {
        Logging.error('Failed to placed Order');
        throw new Error(e);
      }
    });

    // ? PUB / SUB method
    // socket.on('message', async (topic, message) => {
    //   Logging.info(`Received products data from topic --> [${topic}]`);
    //   const products = JSON.parse(message);

    //   const newOrder = await createOrder(products);
    //   socket.send;
    // });

    // socket.subscribe('buy-products');

    // Logging.info('Subscribed to topic buy-products');

    // socket.on('message', async (topic, message) => {
    //   Logging.info(`Received products data from topic --> [${topic}]`);
    //   const products = JSON.parse(message);
    //   const newOrder = await createOrder(products);
    // });
  })
  .catch((e) => {
    Logging.error('ZeroMQ Connection failed');
    throw new Error(e);
  });

app.listen(PORT, () => {
  Logging.info(`Order-Service listening on port --> : ${PORT}`);
});
