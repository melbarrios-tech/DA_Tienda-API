const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

// POST /api/orders  (protegida)
// Body: { "items": [ { "producto": "<id>", "cantidad": 2 } ] }
exports.crearOrden = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Debes enviar al menos un item' });
    }

    let orden;
    await session.withTransaction(async () => {
      const itemsOrden = [];
      let total = 0;

      for (const item of items) {
        const cantidad = Number(item.cantidad);
        if (!Number.isInteger(cantidad) || cantidad < 1) {
          const e = new Error('Cantidad inválida');
          e.status = 400;
          throw e;
        }

        // Descuento atómico: solo si hay stock suficiente
        const producto = await Product.findOneAndUpdate(
          { _id: item.producto, stock: { $gte: cantidad } },
          { $inc: { stock: -cantidad } },
          { new: true, session }
        );

        if (!producto) {
          const existe = await Product.findById(item.producto).session(session);
          const e = new Error(
            existe
              ? `Stock insuficiente para "${existe.nombre}" (disponible: ${existe.stock})`
              : 'Producto no encontrado'
          );
          e.status = existe ? 409 : 404;
          throw e;
        }

        itemsOrden.push({
          producto: producto._id,
          cantidad,
          precioUnitario: producto.precio
        });
        total += producto.precio * cantidad;
      }

      [orden] = await Order.create(
        [{ usuario: req.user._id, items: itemsOrden, total }],
        { session }
      );
    });

    res.status(201).json({ message: 'Orden creada correctamente', orden });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  } finally {
    session.endSession();
  }
};

// POST /api/orders/:id/return  (protegida)
exports.devolverOrden = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let orden;
    await session.withTransaction(async () => {
      orden = await Order.findById(req.params.id).session(session);

      if (!orden) {
        const e = new Error('Orden no encontrada');
        e.status = 404;
        throw e;
      }
      if (orden.usuario.toString() !== req.user._id.toString()) {
        const e = new Error('No tienes permiso para devolver esta orden');
        e.status = 403;
        throw e;
      }
      if (orden.estado === 'devuelta') {
        const e = new Error('La orden ya fue devuelta');
        e.status = 409;
        throw e;
      }

      // Restaurar stock de cada producto
      for (const item of orden.items) {
        await Product.updateOne(
          { _id: item.producto },
          { $inc: { stock: item.cantidad } },
          { session }
        );
      }

      orden.estado = 'devuelta';
      await orden.save({ session });
    });

    res.status(200).json({ message: 'Orden devuelta y stock restaurado', orden });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  } finally {
    session.endSession();
  }
};
