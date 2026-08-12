const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

// 1. Servidor web básico para que Render no suspenda el servicio
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('☕ Bot de Coffee Town está ONLINE 24/7'));
app.listen(PORT, () => console.log(`Servidor HTTP activo en puerto ${PORT}`));

// 2. Función para iniciar la conexión con WhatsApp
async function connectToWhatsApp() {
  // Guarda las credenciales de la sesión en la carpeta "auth_info_baileys"
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  // Escuchar cambios de estado (QR y conexión)
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Si hay un QR disponible, se imprime en consola
    if (qr) {
      console.log('\n📱 ESCANEA ESTE CÓDIGO QR EN RENDER:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada. Intentando reconectar...', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('\n🚀 ¡El Bot de Coffee Town está ONLINE en Render 24/7!\n');
    }
  });

  // Escuchar mensajes entrantes
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase();

    // Helper para responder rápido
    const sendReply = async (replyText) => {
      await sock.sendMessage(from, { text: replyText }, { quoted: msg });
    };

    // A. Pedido desde la Web
    if (text.includes('hola, coffee town') || text.includes('quisiera realizar el siguiente pedido')) {
      await sendReply(
        `☕ *¡Hola! Gracias por escribir a Coffee Town.*\n\n` +
        `Recibimos tu pedido. Para procesarlo de una vez, indícanos:\n` +
        `1. ¿Es para *Retiro en tienda* o *Delivery*?\n` +
        `2. Tu nombre completo.\n\n` +
        `Si deseas realizar el pago de una vez, responde con la palabra *PAGO*.`
      );
      return;
    }

    // B. Comando Menú
    if (text === 'menu' || text === 'menú' || text === '1') {
      await sendReply(
        `📖 Puedes ver nuestra carta actualizada y hacer tu pedido directo aquí:\n` +
        `https://coffee-town-ten.vercel.app/`
      );
      return;
    }

    // C. Datos de Pago
    if (text.includes('pago') || text.includes('datos') || text.includes('pago movil') || text.includes('zelle')) {
      await sendReply(
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

    // D. Ubicación
    if (text.includes('ubicacion') || text.includes('donde estan') || text.includes('direccion') || text.includes('dirección')) {
      await sendReply(`📍 Nos encontramos en [Dirección del local]. ¡Te esperamos!`);
      return;
    }
  });
}

connectToWhatsApp();
