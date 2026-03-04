const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function embedLogo(data) {
  if (data.logo && data.logo.startsWith('data:')) return data.logo;
  try {
    const logoPath = data.logo && data.logo.startsWith('/')
      ? data.logo
      : path.join(__dirname, '..', 'src', 'public', 'img', 'logo-stadium.png');
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    return null;
  }
}

async function generatePlayerReport(data) {
  const htmlTemplate = fs.readFileSync(
    path.join(__dirname, 'player-report.html'),
    'utf8',
  );
  const css = fs.readFileSync(path.join(__dirname, 'player-report.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, 'player-report.js'), 'utf8');

  const html = htmlTemplate
    .replace('<!--STYLE-->', css)
    .replace('<!--DATA-->', JSON.stringify({ ...data, logo: embedLogo(data) }))
    .replace('<!--SCRIPT-->', js);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  // Ensure images (logo) load
  await page.waitForSelector('img#club-logo');
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '6mm', right: '6mm' },
  });
  await browser.close();
  return pdfBuffer;
}

module.exports = { generatePlayerReport };
