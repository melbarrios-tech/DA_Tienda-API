const router = require('express').Router();
const { proteger } = require('../middleware/authMiddleware');
const { crearOrden, devolverOrden } = require('../controllers/orderController');

router.post('/', proteger, crearOrden);
router.post('/:id/return', proteger, devolverOrden);

module.exports = router;
