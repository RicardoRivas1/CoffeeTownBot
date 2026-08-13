const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

// URL de tu Apps Script de Google Sheets (Reemplaza con la tuya)
const GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwDLMX15xfTfPOUl6G8K4UWX545azrRBpZvKpsS9q0vCEtUlvB1yLz3hh-DYaNjwQk/exec';

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('☕ Bot de Coffee Town está ONLINE 24/7'));
app.listen(PORT, () => console.log(`Servidor HTTP activo en puerto ${PORT}`));

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 ESCANEA ESTE CÓDIGO QR EN RENDER:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('\n🚀 ¡El Bot de Coffee Town está ONLINE en Render 24/7!\n');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const rawText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const text = rawText.toLowerCase();

    const sendReply = async (replyText) => {
      await sock.sendMessage(from, { text: replyText }, { quoted: msg });
    };

    // A. Detectar y Registrar Pedido
    if (text.includes('hola, coffee town') || text.includes('quisiera realizar el siguiente pedido')) {
      
      // Intentar extraer el total si viene reflejado en el mensaje (ej: Total: $12.50 o BS)
      let totalEncontrado = 'Por confirmar';
      const matchTotal = rawText.match(/(?:Total|Monto|USD|\$)\s*:?\s*([\$\d\.,]+)/i);
      if (matchTotal) {
        totalEncontrado = matchTotal[1];
      }

      // Enviar datos a Google Sheets mediante fetch
      try {
        await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
            telefono: from.replace('@s.whatsapp.net', ''),
            pedido: rawText,
            total: totalEncontrado
          })
        });
        console.log('✅ Pedido guardado exitosamente en Google Sheets');
      } catch (err) {
        console.error('❌ Error guardando en Google Sheets:', err);
      }

      // Respuesta al cliente
      await sendReply(
        `☕ *¡Pedido Recibido en Coffee Town!*\n\n` +
        `Hemos registrado los detalles de tu orden en nuestro sistema.\n\n` +
        `Por favor indícanos:\n` +
        `1. ¿Es para *Retiro en tienda* o *Delivery*?\n` +
        `2. Tu *Nombre y Apellido*.\n\n` +
        `Si deseas realizar el pago, responde con la palabra *PAGO*.`
      );
      return;
    }

    // B. Menú
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
