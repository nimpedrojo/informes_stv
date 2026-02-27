const express = require('express');
const path = require('path');
const morgan = require('morgan');
const session = require('express-session');
const flash = require('connect-flash');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

const { createUsersTable, ensureAdminUser } = require('./models/userModel');
const { createReportsTable } = require('./models/reportModel');

dotenv.config();

const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'session_secret_dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  }),
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Routes
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');

app.use('/', authRoutes);
app.use('/reports', reportRoutes);

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/reports/new');
  }
  return res.redirect('/login');
});

async function init() {
  await createUsersTable();
  await createReportsTable();
  await ensureAdminUser();
}

init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error initializing database tables', err);
});

module.exports = app;
