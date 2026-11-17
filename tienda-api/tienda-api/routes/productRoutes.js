const router = require('express').Router();
const { proteger } = require('../middleware/authMiddleware');
const { crearProducto, listarProductos } = require('../controllers/productController');

router.get('/', listarProductos);
router.post('/', proteger, crearProducto);

module.exports = router;
