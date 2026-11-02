import { Router } from 'express';
import { createOrderController } from '../controllers/orderController.js';

export function createOrderRouter(db) {
  const router = Router();
  const orderController = createOrderController(db);

  router.post('/', orderController.createOrder);
  router.get('/:id', orderController.getOrderById);

  return router;
}
