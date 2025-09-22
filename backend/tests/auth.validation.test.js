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
      .send({ nombre: 'Test', apellido: 'User', email: 'invalid', contrasena: '123456' });

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

  it('rejects invalid email on forgot password', async () => {
    const res = await request(app)
      .post('/forgot')
      .send({ email: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('mensaje');
  });

  it('rejects missing token on reset password', async () => {
    const res = await request(app)
      .post('/reset')
      .send({ token: '', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('mensaje');
  });
});

