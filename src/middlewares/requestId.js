const { v4: uuidv4 } = require("uuid");

const requestIdMiddleware = (req, res, next) => {
  req.requestId = uuidv4();

  next();
};

module.exports = requestIdMiddleware;