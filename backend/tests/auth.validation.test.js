const assert = require('assert');
const express = require('express');
const request = require('supertest');
const authRoutes = require('../routes/auth.routes');

const app = express();
app.use(express.json());
app.use('/', authRoutes);

(async () => {
  let res = await request(app)
    .post('/register')
    .send({ nombre: 'Test', apellido: 'User', email: 'invalid', contrasena: '123456' });
  assert.strictEqual(res.status, 400);
  console.log('register invalid email -> 400');

  res = await request(app)
    .post('/login')
    .send({ email: 'invalid', contrasena: '123456' });
  assert.strictEqual(res.status, 400);
  console.log('login invalid email -> 400');

  res = await request(app)
    .post('/forgot')
    .send({ email: 'invalid' });
  assert.strictEqual(res.status, 400);
  console.log('forgot invalid email -> 400');

  res = await request(app)
    .post('/reset')
    .send({ token: '', password: '123456' });
  assert.strictEqual(res.status, 400);
  console.log('reset invalid token -> 400');
})();
