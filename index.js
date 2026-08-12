const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    // Configuración obligatoria para servidores como Render / Linux
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  console.log('\n📱 ESCANEA ESTE CÓDIGO QR EN RENDER:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\n🚀 ¡El Bot de Coffee Town está ONLINE en Render 24/7!\n');
});

client.on('message', async (msg) => {
  const text = msg.body.toLowerCase();

  if (text.includes('hola, coffee town') || text.includes('quisiera realizar el siguiente pedido')) {
    await msg.reply(
      `☕ *¡Hola! Gracias por escribir a Coffee Town.*\n\n` +
      `Recibimos tu pedido. Para procesarlo de una vez, indícanos:\n` +
      `1. ¿Es para *Retiro en tienda* o *Delivery*?\n` +
      `2. Tu nombre completo.\n\n` +
      `Si deseas realizar el pago de una vez, responde con la palabra *PAGO*.`
    );
    return;
  }

  if (text === 'menu' || text === 'menú' || text === '1') {
    await msg.reply(
      `📖 Puedes ver nuestra carta actualizada y hacer tu pedido directo aquí:\n` +
      `https://coffee-town-ten.vercel.app/`
    );
    return;
  }

  if (text.includes('pago') || text.includes('datos') || text.includes('pago movil') || text.includes('zelle')) {
    await msg.reply(
      `💳 *Datos de Pago - Coffee Town*\n\n` +
      `📌 *Pago Móvil:*\n` +
      `• Banco: Banesco (0134)\n` +
      `• C.I.: V-12345678\n` +
      `• Tlf: 0412-0000000\n\n` +
      `📌 *Zelle:*\n` +
      `• Correo: pagos@coffeetown.com\n\n` +
      ` Por favor envía el comprobante por aquí al realizar la transferencia.`
    );
    return;
  }

  if (text.includes('ubicacion') || text.includes('donde estan') || text.includes('direccion') || text.includes('dirección')) {
    await msg.reply(`📍 Nos encontramos en [Dirección del local]. ¡Te esperamos!`);
    return;
  }
});

client.initialize();