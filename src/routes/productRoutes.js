import { Router } from 'express';
import { createProductController } from '../controllers/productController.js';

export function createProductRouter(db) {
  const router = Router();
  const productController = createProductController(db);

  router.get('/', productController.listProducts);
  router.get('/:id', productController.getProductById);

  return router;
}
