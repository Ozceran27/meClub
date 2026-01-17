const express = require('express');
const request = require('supertest');
const authRoutes = require('../routes/auth.routes');

describe('Auth routes validation', () => {
  const app = express();
  app.use(express.json());
  app.use('/', authRoutes);

  it('rejects invalid email on register', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        nombre: 'Test',
        apellido: 'User',
        email: 'invalid',
        contrasena: '123456',
        telefono: '1234567',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('mensaje');
  });

  it('rejects invalid phone on register', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        nombre: 'Test',
        apellido: 'User',
        email: 'test@example.com',
        contrasena: '123456',
        telefono: 'abc',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('mensaje');
  });

  it('rejects invalid email on login', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'invalid', contrasena: '123456' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('mensaje');
  });

});
