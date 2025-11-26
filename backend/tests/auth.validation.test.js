const express = require('express');
const request = require('supertest');
const authRoutes = require('../routes/auth.routes');

describe('Auth routes validation', () => {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', 1);
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

  it('limits repeated login attempts', async () => {
    const requestWithIp = () =>
      request(app)
        .post('/login')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ email: 'invalid', contrasena: '123456' });

    for (let i = 0; i < 8; i++) {
      const res = await requestWithIp();

      if (i < 7) {
        expect(res.status).toBe(400);
      }
    }

    const limitedResponse = await requestWithIp();

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      mensaje: 'Demasiadas solicitudes. Intenta nuevamente en unos instantes.',
    });
  });
});

