const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

// ⚠️ REEMPLAZA ESTA URL CON TU URL DE GOOGLE APPS SCRIPT:
const GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/TU_SCRIPT_ID_AQUI/exec';

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

    const nombreCliente = msg.pushName || 'Cliente';

    const sendReply = async (replyText) => {
      await sock.sendMessage(from, { text: replyText }, { quoted: msg });
    };

    // A. Detección y Procesamiento Inteligente del Pedido
    if (text.includes('hola, coffee town') || text.includes('quisiera realizar el siguiente pedido')) {
      
      // 1. Extraer Total USD
      let totalEncontrado = 'Por calcular';
      const matchTotal = rawText.match(/\*Total USD:\*\s*\$?([\d\.,]+)/i) || rawText.match(/Total USD:\s*\$?([\d\.,]+)/i);
      if (matchTotal) {
        totalEncontrado = `$${matchTotal[1]}`;
      }

      // 2. Extraer Método de Pago del mensaje
      let metodoPago = 'Por definir';
      const matchPago = rawText.match(/Método de Pago:\s*(.+)/i);
      if (matchPago) {
        metodoPago = matchPago[1].trim();
      }

      // 3. Extraer Ubicación / Tipo de entrega del mensaje
      let tipoEntrega = 'Por definir';
      const matchEntrega = rawText.match(/Ubicación \/ Retiro:\s*(.+)/i);
      if (matchEntrega) {
        tipoEntrega = matchEntrega[1].trim();
      }

      // 4. Formatear número de teléfono
      let numeroLimpio = from.replace('@s.whatsapp.net', '').replace('@c.us', '').split(':')[0];
      if (!numeroLimpio.startsWith('+')) {
        numeroLimpio = `+${numeroLimpio}`;
      }

      // 5. Registrar en Google Sheets
      try {
        await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
            nombre: nombreCliente,
            telefono: numeroLimpio,
            pedido: rawText,
            total: totalEncontrado,
            entrega: tipoEntrega,
            pago: metodoPago
          })
        });
        console.log(`✅ Pedido completo de ${nombreCliente} registrado en Google Sheets`);
      } catch (err) {
        console.error('❌ Error enviando a Google Sheets:', err);
      }

      // 6. Construir respuesta DINÁMICA según lo que eligió el usuario
      let respuestaBot = `☕ *¡Pedido Recibido, ${nombreCliente}!*\n\n` +
                         `Registramos tu orden por un total de *${totalEncontrado}* 📝.\n\n`;

      // Evaluación del método de pago
      const pagoLower = metodoPago.toLowerCase();
      if (pagoLower.includes('pago movil') || pagoLower.includes('pago móvil') || pagoLower.includes('zelle')) {
        respuestaBot += `💳 *Datos de Pago (${metodoPago}):*\n` +
                        `• *Pago Móvil:* Banesco (0134) | C.I. V-12345678 | Tlf: 0412-0000000\n` +
                        `• *Zelle:* pagos@coffeetown.com\n\n` +
                        `📌 *Por favor reenvíanos el comprobante por aquí para procesar tu café de una vez.*\n\n`;
      } else if (pagoLower.includes('efectivo')) {
        respuestaBot += `💵 Recibiremos tu pago en *Efectivo* al momento de la entrega.\n\n`;
      }

      // Evaluación de tipo de entrega
      const entregaLower = tipoEntrega.toLowerCase();
      if (entregaLower.includes('retiro')) {
        respuestaBot += `📍 *Retiro en tienda:* Te avisaremos por aquí tan pronto tu pedido esté listo para recoger. ¡Nos encontramos en [Dirección del local]!`;
      } else if (entregaLower.includes('delivery')) {
        respuestaBot += `🛵 *Delivery:* Por favor envíanos tu *dirección exacta con punto de referencia* para coordinar el envío.`;
      } else {
        respuestaBot += `📍 Indícanos si pasarás retirando o necesitas *Delivery*.`;
      }

      await sendReply(respuestaBot);
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
