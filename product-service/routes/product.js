require('dotenv').config();
const { Router } = require('express');
const zmq = require('zeromq');
const Product = require('../models/Product');
const Logging = require('../utils/Logging');

const router = new Router();

let socket, orders;

const NODE_ENV = process.env.NODE_ENV || 'development';
const ZMQ_SERVER_URL =
  NODE_ENV === 'production'
    ? process.env.PROD_ZMQ_SERVER_URL
    : process.env.DEV_ZMQ_SERVER_URL;

// Connect to ZeroMQ
const connectToZeroMQ = async () => {
  socket = zmq.socket('req');
  // socket = zmq.socket('pub');
  // socket = zmq.socket('sub');
  await socket.connect(ZMQ_SERVER_URL);
};

connectToZeroMQ()
  .then(() => {
    Logging.info('ZeroMQ Connected Successfully');
  })
  .catch((e) => {
    Logging.error('ZeroMQ Connection failed');
    throw new Error(e);
  });

//Create a new product
router.post('/', async (req, res) => {
  const { name, price, description } = req.body;

  if (!name || !price || !description) {
    Logging.error('Please provide name, price and description');
    return res.status(400).json({
      message: 'Please provide name, price and description',
    });
  }

  try {
    const product = await new Product({ ...req.body });
    await product.save();
    return res.status(201).json({
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    return res.status(400).json({
      message: 'Error while creating product',
      error,
    });
  }
});

// Buying a product
router.post('/buy', async (req, res) => {
  const { productIds } = req.body;

  const products = await Product.find({ _id: { $in: productIds } });

  await socket.send(JSON.stringify(products));

  // Listens for feedback
  socket.on('message', (message) => {
    orders = JSON.parse(message) || null;
    orders &&
      Logging.info(`Order placed Successfully on id --> [${orders?._id}]`);
  });

  return res.status(201).json({
    message: 'Order placed successfully',
    orders,
  });

  // ? PUB / SUB method
  // channel.sendToQueue(
  //   'order-service-queue',
  //   Buffer.from(JSON.stringify({ products }))
  // );

  // socket.send(['buy-products', JSON.stringify(products)]);
  // Logging.info('Published products data on topic buy-products');
});

module.exports = router;
