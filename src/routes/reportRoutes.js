const express = require('express');
const { createReport } = require('../models/reportModel');

const router = express.Router();

function ensureAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Debes iniciar sesión.');
    return res.redirect('/login');
  }
  return next();
}

router.get('/new', ensureAuth, (req, res) => {
  res.render('reports/new', { formData: {}, validationErrors: {} });
});

router.post('/new', ensureAuth, async (req, res) => {
  const {
    player_name,
    player_surname,
    year,
    club,
    team,
    laterality,
    contact,
    pos1,
    pos2,
    pos3,
    pos4,
    overall_rating,
    comments,
    tech_cobertura_balon,
    tech_conduccion,
    tech_control,
    tech_regate,
    tech_disparo,
    tech_pase,
    tech_remate_cabeza,
    tech_anticipacion,
    tact_transicion_ataque_defensa,
    tact_movimientos_sin_balon,
    tact_ayudas_defensivas,
    tact_ayudas_ofensivas,
    tact_desmarques,
    tact_marcajes,
    phys_sacrificio,
    phys_velocidad_punta,
    phys_velocidad_reaccion,
    phys_fuerza,
    phys_potencia,
    phys_resistencia,
    phys_coordinacion,
    psych_concentracion,
    psych_control_emocional,
    psych_reaccion_errores_arbitrales,
    pers_liderazgo,
    pers_disciplina,
    pers_reaccion_correcciones_companero,
    pers_reaccion_correcciones_tecnico,
    recommendation,
    info_reliability,
  } = req.body;

  try {
    // calcular medias de cada bloque a partir de sus sub-valores
    const toNumber = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

    const techValues = [
      tech_cobertura_balon,
      tech_conduccion,
      tech_control,
      tech_regate,
      tech_disparo,
      tech_pase,
      tech_remate_cabeza,
      tech_anticipacion,
    ].map(toNumber).filter((v) => v !== null);
    const tactValues = [
      tact_transicion_ataque_defensa,
      tact_movimientos_sin_balon,
      tact_ayudas_defensivas,
      tact_ayudas_ofensivas,
      tact_desmarques,
      tact_marcajes,
    ].map(toNumber).filter((v) => v !== null);
    const physValues = [
      phys_sacrificio,
      phys_velocidad_punta,
      phys_velocidad_reaccion,
      phys_fuerza,
      phys_potencia,
      phys_resistencia,
      phys_coordinacion,
    ].map(toNumber).filter((v) => v !== null);
    const psychValues = [
      psych_concentracion,
      psych_control_emocional,
      psych_reaccion_errores_arbitrales,
    ].map(toNumber).filter((v) => v !== null);
    const persValues = [
      pers_liderazgo,
      pers_disciplina,
      pers_reaccion_correcciones_companero,
      pers_reaccion_correcciones_tecnico,
    ].map(toNumber).filter((v) => v !== null);

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const techTotal = avg(techValues);
    const tactTotal = avg(tactValues);
    const physTotal = avg(physValues);
    const psychTotal = avg(psychValues);
    const persTotal = avg(persValues);

    if (!player_name || !player_surname) {
      return res.status(400).render('reports/new', {
        formData: req.body,
        validationErrors: {
          player_name: !player_name,
          player_surname: !player_surname,
        },
      });
    }

    await createReport({
      player_name,
      player_surname,
      year: year || null,
      club,
      team,
      laterality,
      contact,
      pos1,
      pos2,
      pos3,
      pos4,
      overall_rating: overall_rating || null,
      comments,
      tech_total: techTotal,
      tact_total: tactTotal,
      phys_total: physTotal,
      psych_total: psychTotal,
      pers_total: persTotal,
      tech_cobertura_balon: tech_cobertura_balon || null,
      tech_conduccion: tech_conduccion || null,
      tech_control: tech_control || null,
      tech_regate: tech_regate || null,
      tech_disparo: tech_disparo || null,
      tech_pase: tech_pase || null,
      tech_remate_cabeza: tech_remate_cabeza || null,
      tech_anticipacion: tech_anticipacion || null,
      tact_transicion_ataque_defensa:
        tact_transicion_ataque_defensa || null,
      tact_movimientos_sin_balon: tact_movimientos_sin_balon || null,
      tact_ayudas_defensivas: tact_ayudas_defensivas || null,
      tact_ayudas_ofensivas: tact_ayudas_ofensivas || null,
      tact_desmarques: tact_desmarques || null,
      tact_marcajes: tact_marcajes || null,
      phys_sacrificio: phys_sacrificio || null,
      phys_velocidad_punta: phys_velocidad_punta || null,
      phys_velocidad_reaccion: phys_velocidad_reaccion || null,
      phys_fuerza: phys_fuerza || null,
      phys_potencia: phys_potencia || null,
      phys_resistencia: phys_resistencia || null,
      phys_coordinacion: phys_coordinacion || null,
      psych_concentracion: psych_concentracion || null,
      psych_control_emocional: psych_control_emocional || null,
      psych_reaccion_errores_arbitrales:
        psych_reaccion_errores_arbitrales || null,
      pers_liderazgo: pers_liderazgo || null,
      pers_disciplina: pers_disciplina || null,
      pers_reaccion_correcciones_companero:
        pers_reaccion_correcciones_companero || null,
      pers_reaccion_correcciones_tecnico:
        pers_reaccion_correcciones_tecnico || null,
      recommendation,
      info_reliability: info_reliability || null,
      created_by: req.session.user.id,
    });
    req.flash('success', 'Informe creado correctamente.');
    return res.redirect('/reports/new');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    req.flash('error', 'Ha ocurrido un error al guardar el informe.');
    return res.redirect('/reports/new');
  }
});

module.exports = router;
