# Informe Técnico — API RESTful Tienda Virtual (Node.js, Express, MongoDB, Mongoose, JWT)

> Las secciones marcadas con **[COMPLETAR]** deben ser reemplazadas con tus datos reales (enlace, IDs, tokens, respuestas obtenidas al probar). Recuerda: solo texto, sin capturas.

## 1. Metadatos del Proyecto

- **Enlace al Repositorio (GitHub):** [COMPLETAR: https://github.com/usuario/tienda-api]
- **Integrantes:** [COMPLETAR]

**Comandos de ejecución:**

```bash
npm install
cp .env.example .env     # luego editar .env con tus credenciales reales
npm run dev              # desarrollo (nodemon)
npm start                # producción
```

**Plantilla de entorno (.env.example):**

```
PORT=3000
MONGODB_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/tienda
JWT_SECRET=cambia_esto_por_un_secreto_largo_y_aleatorio
JWT_EXPIRES_IN=2h
```

Nota: `.env` está en `.gitignore`; solo se sube `.env.example`.

## 2. Arquitectura del Proyecto (MVC)

**Árbol de directorios:**

```
tienda-api/
├── config/
│   └── db.js
├── controllers/
│   ├── authController.js
│   ├── orderController.js
│   └── productController.js
├── middleware/
│   └── authMiddleware.js
├── models/
│   ├── Order.js
│   ├── Product.js
│   └── User.js
├── routes/
│   ├── authRoutes.js
│   ├── orderRoutes.js
│   └── productRoutes.js
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

**Descripción del flujo:**
Una petición entra por `server.js`, que registra `express.json()` y monta los routers bajo `/api/auth`, `/api/products` y `/api/orders`. Cada router únicamente asocia método y ruta con una función del controlador. En las rutas privadas (`POST /api/products`, `POST /api/orders`, `POST /api/orders/:id/return`) se antepone el middleware `proteger`, que lee el header `Authorization: Bearer <token>`, verifica la firma y expiración del JWT con `JWT_SECRET`, carga el usuario desde MongoDB y lo deja en `req.user`; si falla responde 401. El controlador contiene la lógica de negocio y usa los modelos de Mongoose (`User`, `Product`, `Order`) para leer/escribir en MongoDB. Los errores se propagan con `next(error)` hasta el manejador global de `server.js`, que traduce `ValidationError` (400), clave duplicada (409), `CastError` (400) y errores inesperados (500).

## 3. Modelado de Datos (Esquemas de Mongoose)

### Esquema de Usuario (models/User.js)

```js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres']
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
      select: false
    }
  },
  { timestamps: true }
);

// Hash de la contraseña antes de guardar (solo si fue modificada)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.compararPassword = function (passwordPlano) {
  return bcrypt.compare(passwordPlano, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

### Esquema de Producto (models/Product.js)

```js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del producto es obligatorio'],
      unique: true,
      trim: true
    },
    descripcion: { type: String, trim: true, default: '' },
    precio: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [0, 'El precio no puede ser negativo']
    },
    stock: {
      type: Number,
      required: [true, 'El stock es obligatorio'],
      min: [0, 'El stock no puede ser negativo'],
      validate: {
        validator: Number.isInteger,
        message: 'El stock debe ser un número entero'
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
```

### Esquema de Orden (models/Order.js)

```js
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
```

### Validaciones aplicadas

- **required** en todos los campos esenciales, con mensajes personalizados.
- **unique** en `User.email` y `Product.nombre` (índices únicos; el error 11000 se devuelve como 409).
- **Tipos de datos** correctos (String, Number, ObjectId) y **min/minlength/enum** (precio ≥ 0, stock ≥ 0 y entero, cantidad ≥ 1, estado ∈ {completada, devuelta}).
- **match** (regex) para validar formato de email; `lowercase` y `trim` para normalizar.
- **Referencias con ObjectId**: `Order.usuario → User` y `Order.items.producto → Product`.
- `password` con `select: false` para que nunca se devuelva en consultas por defecto.
- Se guarda `precioUnitario` en cada item para conservar el precio histórico de la compra.

## 4. Documentación de Endpoints y Pruebas (Texto Plano)

> Los JSON de abajo muestran el formato que devuelve la API. **[COMPLETAR]** Reemplázalos por los valores reales que obtengas al probar (IDs, token, fechas).

### 4.1 Registro

- **Endpoint:** `POST /api/auth/register`
- **Headers requeridos:** `Content-Type: application/json`
- **Request Payload:**

```json
{
  "nombre": "Melanie Barrios",
  "email": "melanie@example.com",
  "password": "123456"
}
```

- **Response (201 Created):**

```json
{
  "message": "Usuario registrado correctamente",
  "usuario": {
    "id": "<ID_USUARIO>",
    "nombre": "Melanie Barrios",
    "email": "melanie@example.com"
  }
}
```

- **Respuesta de error (email repetido, 409 Conflict):**

```json
{
  "message": "Valor duplicado",
  "campo": { "email": "melanie@example.com" }
}
```

### 4.2 Login

- **Endpoint:** `POST /api/auth/login`
- **Headers requeridos:** `Content-Type: application/json`
- **Request Payload:**

```json
{
  "email": "melanie@example.com",
  "password": "123456"
}
```

- **Response (200 OK):**

```json
{
  "message": "Login exitoso",
  "token": "<JWT>",
  "usuario": {
    "id": "<ID_USUARIO>",
    "nombre": "Melanie Barrios",
    "email": "melanie@example.com"
  }
}
```

- **Respuesta de error (contraseña incorrecta, 401 Unauthorized):**

```json
{ "message": "Credenciales inválidas" }
```

### 4.3 (Apoyo) Crear Producto — necesario para poder probar órdenes

- **Endpoint:** `POST /api/products`
- **Headers requeridos:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Request Payload:**

```json
{
  "nombre": "Laptop Lenovo",
  "descripcion": "Laptop 15 pulgadas",
  "precio": 2500,
  "stock": 10
}
```

- **Response (201 Created):**

```json
{
  "_id": "<ID_PRODUCTO>",
  "nombre": "Laptop Lenovo",
  "descripcion": "Laptop 15 pulgadas",
  "precio": 2500,
  "stock": 10,
  "createdAt": "<FECHA>",
  "updatedAt": "<FECHA>",
  "__v": 0
}
```

- **Sin token (401 Unauthorized):**

```json
{ "message": "Token no proporcionado" }
```

### 4.4 Crear Orden

- **Endpoint:** `POST /api/orders`
- **Headers requeridos:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Request Payload:**

```json
{
  "items": [
    { "producto": "<ID_PRODUCTO>", "cantidad": 2 }
  ]
}
```

- **Response (201 Created)** — el stock del producto baja de 10 a 8:

```json
{
  "message": "Orden creada correctamente",
  "orden": {
    "_id": "<ID_ORDEN>",
    "usuario": "<ID_USUARIO>",
    "items": [
      { "producto": "<ID_PRODUCTO>", "cantidad": 2, "precioUnitario": 2500 }
    ],
    "total": 5000,
    "estado": "completada",
    "createdAt": "<FECHA>",
    "updatedAt": "<FECHA>"
  }
}
```

- **Respuesta de error (stock insuficiente, 409 Conflict):**

```json
{ "message": "Stock insuficiente para \"Laptop Lenovo\" (disponible: 8)" }
```

- **Respuesta de error (producto inexistente, 404 Not Found):**

```json
{ "message": "Producto no encontrado" }
```

### 4.5 Devolver Orden

- **Endpoint:** `POST /api/orders/:id/return`
- **Headers requeridos:** `Authorization: Bearer <token>` (no requiere body)
- **Request Payload:** ninguno (`POST /api/orders/<ID_ORDEN>/return`)
- **Response (200 OK)** — el stock vuelve de 8 a 10:

```json
{
  "message": "Orden devuelta y stock restaurado",
  "orden": {
    "_id": "<ID_ORDEN>",
    "usuario": "<ID_USUARIO>",
    "items": [
      { "producto": "<ID_PRODUCTO>", "cantidad": 2, "precioUnitario": 2500 }
    ],
    "total": 5000,
    "estado": "devuelta",
    "createdAt": "<FECHA>",
    "updatedAt": "<FECHA>"
  }
}
```

- **Respuesta de error (ya devuelta, 409 Conflict):**

```json
{ "message": "La orden ya fue devuelta" }
```

- **Respuesta de error (orden de otro usuario, 403 Forbidden):**

```json
{ "message": "No tienes permiso para devolver esta orden" }
```

## 5. Reflexión Técnica

### Gestión de Seguridad (Contraseñas y JWT)

Las contraseñas nunca se guardan en texto plano: un hook `pre('save')` del esquema de Usuario aplica `bcrypt.hash(password, 10)` (10 rondas de salt) solo cuando el campo fue modificado. En el login, `bcrypt.compare` contrasta la contraseña recibida con el hash almacenado; si no coincide, se responde 401 con un mensaje genérico para no revelar si el email existe. El campo `password` tiene `select: false`, por lo que no se expone en ninguna consulta salvo que se pida explícitamente.

Al autenticarse correctamente, el servidor firma un JWT con `jwt.sign({ id }, JWT_SECRET, { expiresIn })`. El secreto y la expiración viven en `.env` (excluido del repositorio con `.gitignore`). El middleware `proteger` extrae el token del header `Authorization: Bearer`, lo verifica con `jwt.verify` (firma y expiración), comprueba que el usuario aún exista y lo adjunta a `req.user`. Responde 401 si el token falta, es inválido o expiró. Las rutas de creación de productos, creación de órdenes y devolución de órdenes están protegidas con este middleware; además, solo el dueño de una orden puede devolverla.

### Manejo de Transacciones y Errores

La creación de una orden y su devolución se ejecutan dentro de una **transacción de MongoDB** (`session.withTransaction`), de modo que o se aplican todos los cambios o ninguno. Al crear una orden, por cada item se hace un `findOneAndUpdate` atómico con la condición `stock >= cantidad` y `$inc: { stock: -cantidad }`; esto evita stock negativo incluso con compras simultáneas. Si algún producto no existe o no tiene stock suficiente, se lanza un error y la transacción se revierte (los descuentos previos de la misma orden se deshacen). El precio se toma de la base de datos (no del cliente) y se calcula el total en el servidor.

Al devolver una orden se verifica que exista, que pertenezca al usuario y que no esté ya `devuelta`; luego se restaura el stock con `$inc: { stock: +cantidad }` por cada item y se cambia el estado a `devuelta`, todo en la misma transacción, lo que impide devolver dos veces la misma orden. Los errores de negocio devuelven códigos HTTP claros (400, 403, 404, 409) y los demás pasan al manejador global de `server.js` (validación → 400, duplicados → 409, ID inválido → 400, otros → 500). Nota: las transacciones requieren un replica set; MongoDB Atlas (cluster `mongodb+srv`) ya lo es.
