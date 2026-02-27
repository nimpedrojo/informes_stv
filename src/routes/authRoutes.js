const express = require('express');
const bcrypt = require('bcryptjs');
const { createUser, findUserByEmail } = require('../models/userModel');

const router = express.Router();

function ensureGuest(req, res, next) {
  if (req.session.user) {
    return res.redirect('/reports/new');
  }
  return next();
}

function ensureAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Debes iniciar sesión.');
    return res.redirect('/login');
  }
  return next();
}

router.get('/login', ensureGuest, (req, res) => {
  res.render('auth/login');
});

router.post('/login', ensureGuest, async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      req.flash('error', 'Usuario o contraseña incorrectos.');
      return res.redirect('/login');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      req.flash('error', 'Usuario o contraseña incorrectos.');
      return res.redirect('/login');
    }
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    req.flash('success', 'Has iniciado sesión correctamente.');
    return res.redirect('/reports/new');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    req.flash('error', 'Ha ocurrido un error al iniciar sesión.');
    return res.redirect('/login');
  }
});

router.get('/register', ensureGuest, (req, res) => {
  res.render('auth/register');
});

router.post('/register', ensureGuest, async (req, res) => {
  const { name, email, password, password2 } = req.body;
  if (!name || !email || !password) {
    req.flash('error', 'Todos los campos son obligatorios.');
    return res.redirect('/register');
  }
  if (password !== password2) {
    req.flash('error', 'Las contraseñas no coinciden.');
    return res.redirect('/register');
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      req.flash('error', 'Ya existe un usuario con ese email.');
      return res.redirect('/register');
    }
    await createUser({ name, email, password });
    req.flash('success', 'Usuario creado. Ahora puedes iniciar sesión.');
    return res.redirect('/login');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    req.flash('error', 'Ha ocurrido un error al registrar usuario.');
    return res.redirect('/register');
  }
});

router.post('/logout', ensureAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
