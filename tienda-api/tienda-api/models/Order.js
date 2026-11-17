const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    cantidad: {
      type: Number,
      required: true,
      min: [1, 'La cantidad mínima es 1'],
      validate: { validator: Number.isInteger, message: 'La cantidad debe ser entera' }
    },
    precioUnitario: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: {
      type: [itemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'La orden debe tener al menos un producto'
      }
    },
    total: { type: Number, required: true, min: 0 },
    estado: {
      type: String,
      enum: ['completada', 'devuelta'],
      default: 'completada'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
