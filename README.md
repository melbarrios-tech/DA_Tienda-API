# tienda-api

API RESTful de una tienda virtual desarrollada con Node.js, Express, MongoDB, Mongoose y JWT, bajo el patrón MVC.

## Funcionalidades
- Registro y login de usuarios (contraseñas con bcrypt, autenticación con JWT)
- Gestión de productos
- Creación de órdenes con descuento de stock
- Devolución de órdenes con restauración de stock
- Transacciones de MongoDB para mantener la consistencia

## Instalación
npm install
cp .env.example .env   # completar con tus credenciales
npm run dev

## Endpoints
POST /api/auth/register
POST /api/auth/login
GET  /api/products
POST /api/products          (requiere token)
POST /api/orders            (requiere token)
POST /api/orders/:id/return (requiere token)

## Autores
- Barrios Lopez, Melanie Jared
- Ccosi Mamani, Alexia Linsay
- Perez Palli, Brandon Alexis
- Rodrigo Medina, Jean Piero
