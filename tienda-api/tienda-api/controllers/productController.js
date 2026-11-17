const Product = require('../models/Product');

// POST /api/products  (protegida)
exports.crearProducto = async (req, res, next) => {
  try {
    const { nombre, descripcion, precio, stock } = req.body;
    const producto = await Product.create({ nombre, descripcion, precio, stock });
    res.status(201).json(producto);
  } catch (error) {
    next(error);
  }
};

// GET /api/products  (pública)
exports.listarProductos = async (req, res, next) => {
  try {
    const productos = await Product.find();
    res.status(200).json(productos);
  } catch (error) {
    next(error);
  }
};
