const express = require('express');
const {
  getAllUsers,
  updateUserRole,
  deleteUser,
  findUserById,
  updateUserAccount,
} = require('../models/userModel');

const router = express.Router();

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.flash('error', 'No tienes permisos para acceder a esta sección.');
    return res.redirect('/');
  }
  return next();
}

// Listado de usuarios registrados
router.get('/', ensureAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    return res.render('users/list', { users, currentUser: req.session.user });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al obtener usuarios:', err);
    req.flash('error', 'Ha ocurrido un error al cargar los usuarios.');
    return res.redirect('/');
  }
});

// Cambiar rol de un usuario
router.post('/:id/role', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    req.flash('error', 'Rol no válido.');
    return res.redirect('/admin/users');
  }

  try {
    // Evitar que un admin se quite a sí mismo todos los permisos por accidente
    if (Number(id) === req.session.user.id && role !== 'admin') {
      req.flash(
        'error',
        'No puedes cambiar tu propio rol a un perfil sin permisos de administrador.',
      );
      return res.redirect('/admin/users');
    }

    await updateUserRole(id, role);
    req.flash('success', 'Rol actualizado correctamente.');
    return res.redirect('/admin/users');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al actualizar rol de usuario:', err);
    req.flash('error', 'Ha ocurrido un error al actualizar el rol.');
    return res.redirect('/admin/users');
  }
});

// Borrar usuario
router.post('/:id/delete', ensureAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    if (Number(id) === req.session.user.id) {
      req.flash('error', 'No puedes borrar tu propio usuario.');
      return res.redirect('/admin/users');
    }

    await deleteUser(id);
    req.flash('success', 'Usuario borrado correctamente.');
    return res.redirect('/admin/users');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al borrar usuario:', err);
    req.flash('error', 'Ha ocurrido un error al borrar el usuario.');
    return res.redirect('/admin/users');
  }
});

// Formulario de edición de usuario (datos básicos y configuraciones)
router.get('/:id/edit', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await findUserById(id);
    if (!user) {
      req.flash('error', 'Usuario no encontrado.');
      return res.redirect('/admin/users');
    }
    return res.render('users/edit', { user });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al cargar usuario para edición:', err);
    req.flash('error', 'Ha ocurrido un error al cargar el usuario.');
    return res.redirect('/admin/users');
  }
});

router.post('/:id/edit', ensureAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, default_club, default_team } = req.body;

  if (!name || !email) {
    req.flash('error', 'Nombre y email son obligatorios.');
    return res.redirect(`/admin/users/${id}/edit`);
  }

  try {
    const affected = await updateUserAccount(id, {
      name,
      email,
      defaultClub: default_club || null,
      defaultTeam: default_team || null,
    });
    if (!affected) {
      req.flash('error', 'No se ha podido actualizar el usuario.');
      return res.redirect(`/admin/users/${id}/edit`);
    }

    req.flash('success', 'Usuario actualizado correctamente.');
    return res.redirect('/admin/users');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error al actualizar usuario:', err);
    req.flash('error', 'Ha ocurrido un error al actualizar el usuario.');
    return res.redirect(`/admin/users/${id}/edit`);
  }
});

module.exports = router;
