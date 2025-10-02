// Cargar variables de entorno
require('dotenv').config();

const express = require("express");

const app = express();
app.use(express.json());

// Variables desde el .env para WhatsApp
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const PORT = process.env.PORT || 3000;

// 🗂️ Almacenar usuarios y sus últimas interacciones
const userSessions = new Map();

// ⏰ 24 horas en milisegundos
const WELCOME_TIMEOUT = 24 * 60 * 60 * 1000;

// 👉 Ruta GET para la verificación de WhatsApp
app.get("/webhook", (req, res) => {
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verificado correctamente.");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// 👉 Ruta POST para recibir mensajes de WhatsApp
app.post("/webhook", (req, res) => {
  let body = req.body;

  if (body.object === "whatsapp_business_account") {
    body.entry.forEach(entry => {
      let changes = entry.changes[0];
      let value = changes.value;
      
      if (value.messages) {
        value.messages.forEach(message => {
          let from = message.from; // Número de teléfono del usuario
          handleMessage(from, message);
        });
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// 👉 Función para responder mensajes
function handleMessage(from, received_message) {
  const now = Date.now();
  const userSession = userSessions.get(from);
  
  // Verificar si necesita mensaje de bienvenida
  let needsWelcome = false;
  
  if (!userSession) {
    // Usuario nuevo - primera vez
    needsWelcome = true;
    console.log(`🆕 Usuario nuevo detectado: ${from}`);
  } else {
    // Usuario existente - verificar si han pasado 24 horas
    const timeSinceLastMessage = now - userSession.lastMessageTime;
    const hoursElapsed = timeSinceLastMessage / (1000 * 60 * 60);
    
    console.log(`⏰ Usuario ${from} - Horas desde último mensaje: ${hoursElapsed.toFixed(2)}`);
    
    if (timeSinceLastMessage >= WELCOME_TIMEOUT) {
      needsWelcome = true;
      console.log(`⏰ Han pasado más de 24 horas, enviando nueva bienvenida a: ${from}`);
    } else {
      console.log(`✋ Usuario ${from} aún en período de 24h, NO se envía bienvenida`);
    }
  }
  
  // SIEMPRE actualizar la sesión del usuario (incluso si el envío falla)
  userSessions.set(from, {
    lastMessageTime: now,
    hasReceivedWelcome: userSession?.hasReceivedWelcome || needsWelcome
  });
  
  // Enviar mensaje de bienvenida si es necesario
  if (needsWelcome) {
    const welcomeMessage = "¡Hola! 👋 Bienvenido a *CASIS accesorios para tu mascota*. Gracias por escribirnos ❤️\n\n¿En qué podemos ayudarte hoy?";
    
    callSendAPI(from, welcomeMessage);
    console.log(`📩 Intentando enviar mensaje de bienvenida a: ${from}`);
  } else {
    console.log(`⏭️ Usuario ${from} ya tiene sesión activa, no se envía bienvenida`);
  }
}

// 👉 Llamar a la API de WhatsApp
async function callSendAPI(to, message) {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
  
  const data = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: {
      body: message
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (result.error) {
      console.error("❌ Error de WhatsApp API:", result.error);
      if (result.error.code === 190) {
        console.error("🚨 TOKEN INVÁLIDO - Necesitas generar un nuevo token de acceso");
      }
    } else {
      console.log("✅ Mensaje de WhatsApp enviado exitosamente:", result);
    }
  } catch (error) {
    console.error("❌ Error de conexión:", error.message);
  }
}

// 👉 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});